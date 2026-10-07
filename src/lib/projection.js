import { addDays, formatDate } from './dates.js'

// Slots 1-3 are free services. A lapsed slot still uses up one of them.
export const FREE_SERVICES = 3

const FREE_LADDER = {
  1: { km: 'firstServiceKm', days: 'firstServiceDays' },
  2: { km: 'secondServiceKm', days: 'secondServiceDays' },
  3: { km: 'thirdServiceKm', days: 'thirdServiceDays' },
}

export const serviceTypeOf = (serviceNo) => (serviceNo <= FREE_SERVICES ? 'Free' : 'PMS')

const km = (value) => `${value.toLocaleString('en-IN')} km`

// Matches on model name; prefers the rule for the invoice year, else the newest rule.
export function findRule(rules, model, invoiceDate) {
  const name = model.trim().toLowerCase()
  const matches = rules.filter((rule) => rule.model.trim().toLowerCase() === name)
  const year = Number(invoiceDate.slice(0, 4))
  return matches.find((rule) => rule.year === year) ?? matches[0]
}

// Free service: fixed ladder from the invoice date, never moves even after a lapse.
// km range (service km - km limit) to service km, date range (invoice + days) to (+ day limit).
function projectFreeService(rule, invoiceDate, serviceNo) {
  const { km: kmKey, days: daysKey } = FREE_LADDER[serviceNo]
  return {
    serviceNo,
    serviceType: 'Free',
    kmFrom: Math.max(0, rule[kmKey] - rule.kmLimit),
    kmTo: rule[kmKey],
    dueDateFrom: addDays(invoiceDate, rule[daysKey]),
    dueDateTo: addDays(invoiceDate, rule[daysKey] + rule.dayLimit),
    basis: `Free service from the master rule: ${km(rule[kmKey])} / ${rule[daysKey]} days after the invoice date (${formatDate(invoiceDate)}).`,
  }
}

// PMS: chains off the last actual service. Range is target to target + limit.
function projectPmsService(rule, serviceNo, last) {
  const targetKm = last.kmDoneAt + rule.recursiveKm
  const targetDate = addDays(last.doneDate, rule.recursiveDays)
  return {
    serviceNo,
    serviceType: 'PMS',
    kmFrom: targetKm,
    kmTo: targetKm + rule.kmLimit,
    dueDateFrom: targetDate,
    dueDateTo: addDays(targetDate, rule.dayLimit),
    basis: `PMS from the last service (${km(last.kmDoneAt)} on ${formatDate(last.doneDate)}) + recursive ${km(rule.recursiveKm)} / ${rule.recursiveDays} days.`,
  }
}

// `last` is the most recent actual service ({ kmDoneAt, doneDate }); only PMS uses it.
export const projectService = (rule, invoiceDate, serviceNo, last) =>
  serviceNo <= FREE_SERVICES ? projectFreeService(rule, invoiceDate, serviceNo) : projectPmsService(rule, serviceNo, last)

const ordinal = (n) => {
  const suffix = { one: 'st', two: 'nd', few: 'rd', other: 'th' }[new Intl.PluralRules('en', { type: 'ordinal' }).select(n)]
  return `${n}${suffix}`
}

export const serviceLabel = (serviceNo) => `${ordinal(serviceNo)} Service`

export const formatKmRange = ({ kmFrom, kmTo }) =>
  `${kmFrom.toLocaleString('en-IN')} – ${kmTo.toLocaleString('en-IN')} km`

export const formatDateRange = ({ dueDateFrom, dueDateTo }) => `${formatDate(dueDateFrom)} – ${formatDate(dueDateTo)}`

// Why a service lapsed, e.g. "above the due KM (1,000 km) and after the due date (24 Apr 2026)".
export const lapseReason = ({ overKm, overDate, kmTo, dueDateTo }) =>
  [overKm && `above the due KM (${km(kmTo)})`, overDate && `after the due date (${formatDate(dueDateTo)})`]
    .filter(Boolean)
    .join(' and ')

// Older vehicle with no service history: assume past services followed the master rule schedule.
// A service counts as past once its whole due window (date + day limit) has ended before `asOf`.
// Returns how many services are past and the projection for the next one.
export function projectFromAge(rule, invoiceDate, asOf) {
  const plannedDay = (n) =>
    n <= FREE_SERVICES ? rule[FREE_LADDER[n].days] : rule.thirdServiceDays + (n - FREE_SERVICES) * rule.recursiveDays
  const plannedKm = (n) =>
    n <= FREE_SERVICES ? rule[FREE_LADDER[n].km] : rule.thirdServiceKm + (n - FREE_SERVICES) * rule.recursiveKm

  let pastCount = 0
  while (addDays(invoiceDate, plannedDay(pastCount + 1) + rule.dayLimit) < asOf) pastCount++

  const nextNo = pastCount + 1
  if (nextNo <= FREE_SERVICES) return { pastCount, projection: projectFreeService(rule, invoiceDate, nextNo) }

  const last = { kmDoneAt: plannedKm(pastCount), doneDate: addDays(invoiceDate, plannedDay(pastCount)) }
  return {
    pastCount,
    projection: {
      ...projectPmsService(rule, nextNo, last),
      basis: `Estimated from the vehicle's age (no service history entered). Assumes the ${serviceLabel(pastCount)} was done on the master rule schedule, around ${km(last.kmDoneAt)} on ${formatDate(last.doneDate)}, + recursive ${km(rule.recursiveKm)} / ${rule.recursiveDays} days.`,
    },
  }
}
