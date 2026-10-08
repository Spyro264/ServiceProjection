import { addDays, formatDate } from './dates.js'

// The rule's free services as [{ km, days }], one per slot. A lapsed slot still uses up one of them.
// Rules saved before the free-service count was added have three fixed fields.
export const freeServicesOf = (rule) =>
  rule.freeServices ?? [
    { km: rule.firstServiceKm, days: rule.firstServiceDays },
    { km: rule.secondServiceKm, days: rule.secondServiceDays },
    { km: rule.thirdServiceKm, days: rule.thirdServiceDays },
  ]

export const freeCountOf = (rule) => freeServicesOf(rule).length

const km = (value) => `${value.toLocaleString('en-IN')} km`

// e.g. "3 free services, then PMS every 2,500 km / 60 days".
export function ruleSummary(rule) {
  const count = freeCountOf(rule)
  return `${count} free service${count === 1 ? '' : 's'}, then PMS every ${km(rule.recursiveKm)} / ${rule.recursiveDays} days`
}

export const serviceTypeOf = (serviceNo, rule) => (serviceNo <= freeCountOf(rule) ? 'Free' : 'PMS')

// Free service: fixed ladder from the invoice date, never moves even after a lapse.
// km range (service km - km limit) to service km, date range (invoice + days) to (+ day limit).
function projectFreeService(rule, invoiceDate, serviceNo) {
  const free = freeServicesOf(rule)[serviceNo - 1]
  return {
    serviceNo,
    serviceType: 'Free',
    kmFrom: Math.max(0, free.km - rule.kmLimit),
    kmTo: free.km,
    dueDateFrom: addDays(invoiceDate, free.days),
    dueDateTo: addDays(invoiceDate, free.days + rule.dayLimit),
    basis: `Free service from the master rule: ${km(free.km)} / ${free.days} days after the invoice date (${formatDate(invoiceDate)}).`,
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
  serviceNo <= freeCountOf(rule) ? projectFreeService(rule, invoiceDate, serviceNo) : projectPmsService(rule, serviceNo, last)

export const ordinal = (n) => {
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
  const free = freeServicesOf(rule)
  const lastFree = free[free.length - 1]
  const plannedDay = (n) =>
    n <= free.length ? free[n - 1].days : lastFree.days + (n - free.length) * rule.recursiveDays
  const plannedKm = (n) => (n <= free.length ? free[n - 1].km : lastFree.km + (n - free.length) * rule.recursiveKm)

  let pastCount = 0
  while (addDays(invoiceDate, plannedDay(pastCount + 1) + rule.dayLimit) < asOf) pastCount++

  const nextNo = pastCount + 1
  if (nextNo <= free.length) return { pastCount, projection: projectFreeService(rule, invoiceDate, nextNo) }

  const last = { kmDoneAt: plannedKm(pastCount), doneDate: addDays(invoiceDate, plannedDay(pastCount)) }
  return {
    pastCount,
    projection: {
      ...projectPmsService(rule, nextNo, last),
      basis: `Estimated from the vehicle's age (no service history entered). Assumes the ${serviceLabel(pastCount)} was done on the master rule schedule, around ${km(last.kmDoneAt)} on ${formatDate(last.doneDate)}, + recursive ${km(rule.recursiveKm)} / ${rule.recursiveDays} days.`,
    },
  }
}
