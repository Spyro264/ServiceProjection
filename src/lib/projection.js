import { addDays, formatDate } from './dates.js'

// A rule has a name and an ordered `schedule` of services:
// { serviceNo, type, days, km, daysLower, daysUpper, kmLower, kmUpper, base, recursive, count, kmInterval }
// serviceNo is the entry's position (1, 2, 3 ...). type is a free-text label ("Free", "PMS" ...); the 1st is always "Free".
// days / km are the ideal point ("Service Active After" / "Service Due After"); the buffers widen it into the due window
// daysMin–daysMax / kmMin–kmMax (see windowOf).
// base says what the limits are counted from: 'invoice' (invoice date, odo 0), 'actual' (last service odo / date)
// or 'projected' (end of the previous projected window). Entries counted from a previous service can be recursive:
// they then take `count` service slots instead of one. After the last entry, nothing more is projected.
// Due window: ideal − lower limit to ideal + upper limit, for days and for km.
// Rules saved before the 1st service had buffers: it is due any time within its days / km.
export const windowOf = ({ days, km, daysLower, daysUpper, kmLower, kmUpper }) =>
  daysLower == null
    ? { daysMin: 0, daysMax: days, kmMin: 0, kmMax: km }
    : { daysMin: days - daysLower, daysMax: days + daysUpper, kmMin: km - kmLower, kmMax: km + kmUpper }

export function scheduleOf(rule) {
  if (rule.schedule) {
    // Rules saved before the buffers have daysMin / daysMax / kmMin / kmMax directly.
    // Rules saved with a Free / PMS type: Free entries were counted from the invoice date.
    return rule.schedule.map((entry, i) => ({
      serviceNo: i + 1,
      ...entry,
      ...(entry.days != null && windowOf(entry)),
      base: entry.base ?? 'invoice',
    }))
  }
  // Rules saved before per-service ranges: free km/days with a shared km/day limit, then PMS forever.
  const free = rule.freeServices ?? [
    { km: rule.firstServiceKm, days: rule.firstServiceDays },
    { km: rule.secondServiceKm, days: rule.secondServiceDays },
    { km: rule.thirdServiceKm, days: rule.thirdServiceDays },
  ]
  return [
    ...free.map(({ km, days }, i) => ({
      serviceNo: i + 1,
      type: 'Free',
      daysMin: days,
      daysMax: days + rule.dayLimit,
      kmMin: Math.max(0, km - rule.kmLimit),
      kmMax: km,
      base: 'invoice',
    })),
    {
      serviceNo: free.length + 1,
      type: 'PMS',
      daysMin: rule.recursiveDays,
      daysMax: rule.recursiveDays + rule.dayLimit,
      kmMin: rule.recursiveKm,
      kmMax: rule.recursiveKm + rule.kmLimit,
      base: 'actual',
      recursive: true,
      count: Infinity,
    },
  ]
}

// How many service slots an entry takes.
export const slotCountOf = (entry) => (entry.base !== 'invoice' && entry.recursive ? entry.count : 1)

// The schedule entry for a service number, or undefined once the schedule has run out.
function entryFor(rule, serviceNo) {
  let slotsBefore = 0
  for (const entry of scheduleOf(rule)) {
    slotsBefore += slotCountOf(entry)
    if (serviceNo <= slotsBefore) return entry
  }
  return undefined
}

export const isFree = (type) => type.trim().toLowerCase() === 'free'

// Free services come first in a schedule, so slots 1..freeCount are the free services.
export const freeCountOf = (rule) => scheduleOf(rule).filter((entry) => isFree(entry.type)).length

const km = (value) => `${value.toLocaleString('en-IN')} km`
const kmRange = (from, to) => `${from.toLocaleString('en-IN')}–${to.toLocaleString('en-IN')} km`

// e.g. "Free → Free → PMS ×5".
export function ruleSummary(rule) {
  return scheduleOf(rule)
    .map((entry) => {
      const slots = slotCountOf(entry)
      return slots === Infinity ? `${entry.type} (repeats)` : slots > 1 ? `${entry.type} ×${slots}` : entry.type
    })
    .join(' → ')
}

// The rule's name, or its summary for rules saved before rules had names.
export const ruleTitle = (rule) => rule.name || ruleSummary(rule)

const baseText = { invoice: 'invoice date', actual: 'last service', projected: 'projected service' }

// What an entry is counted from and how it repeats, e.g. "From last service · repeats 5 times".
export function entryDetail(entry) {
  const from = `From ${baseText[entry.base]}`
  if (entry.base === 'invoice') return from
  const slots = slotCountOf(entry)
  return `${from} · ${slots === Infinity ? 'repeats' : slots > 1 ? `repeats ${slots} times` : 'once'}`
}

export const serviceTypeOf = (serviceNo, rule) => entryFor(rule, serviceNo)?.type ?? 'PMS'

const rangeText = (entry) => `${entry.daysMin}–${entry.daysMax} days / ${kmRange(entry.kmMin, entry.kmMax)}`

// Counted from the invoice date: a fixed ladder that never moves, even after a lapse.
function projectFromInvoice(entry, invoiceDate, serviceNo) {
  return {
    serviceNo,
    serviceType: entry.type,
    kmFrom: entry.kmMin,
    kmTo: entry.kmMax,
    dueDateFrom: addDays(invoiceDate, entry.daysMin),
    dueDateTo: addDays(invoiceDate, entry.daysMax),
    basis: `${entry.type} service from the rule: ${rangeText(entry)} after the invoice date (${formatDate(invoiceDate)}).`,
  }
}

// Counted from the previous service — its actual odo / date, or the end of its projected window.
// With no projected window to use (e.g. last service entered at onboarding), the actual service is used.
function projectFromPrevious(entry, serviceNo, last) {
  const fromProjected = entry.base === 'projected' && last.kmTo != null
  const baseKm = fromProjected ? last.kmTo : last.kmDoneAt
  const baseDate = fromProjected ? last.dueDateTo : last.doneDate
  return {
    serviceNo,
    serviceType: entry.type,
    kmFrom: baseKm + entry.kmMin,
    kmTo: baseKm + entry.kmMax,
    dueDateFrom: addDays(baseDate, entry.daysMin),
    dueDateTo: addDays(baseDate, entry.daysMax),
    basis: `${entry.type} from the ${fromProjected ? 'previous projected service' : 'last service'} (${km(baseKm)} on ${formatDate(baseDate)}) + ${rangeText(entry)}.`,
  }
}

// `last` is the most recent service ({ kmDoneAt, doneDate }, plus its projected kmTo / dueDateTo when known);
// only entries counted from a previous service use it. Returns null once the rule's schedule has run out.
export function projectService(rule, invoiceDate, serviceNo, last) {
  const entry = entryFor(rule, serviceNo)
  if (!entry) return null
  return entry.base === 'invoice' ? projectFromInvoice(entry, invoiceDate, serviceNo) : projectFromPrevious(entry, serviceNo, last)
}

export const ordinal = (n) => {
  const suffix = { one: 'st', two: 'nd', few: 'rd', other: 'th' }[new Intl.PluralRules('en', { type: 'ordinal' }).select(n)]
  return `${n}${suffix}`
}

export const serviceLabel = (serviceNo) => `${ordinal(serviceNo)} Service`

// Which service numbers each schedule entry covers, e.g. "1st Service", "4th–8th Service".
export function slotLabels(schedule) {
  let next = 1
  return schedule.map((entry) => {
    const slots = slotCountOf(entry)
    const from = next
    next += slots
    if (slots === Infinity) return `${ordinal(from)} Service onward`
    return slots > 1 ? `${ordinal(from)}–${ordinal(from + slots - 1)} Service` : serviceLabel(from)
  })
}

export const formatKmRange = ({ kmFrom, kmTo }) =>
  `${kmFrom.toLocaleString('en-IN')} – ${kmTo.toLocaleString('en-IN')} km`

export const formatDateRange = ({ dueDateFrom, dueDateTo }) => `${formatDate(dueDateFrom)} – ${formatDate(dueDateTo)}`

// Why a service lapsed, e.g. "above the due KM (1,000 km) and after the due date (24 Apr 2026)".
export const lapseReason = ({ overKm, overDate, kmTo, dueDateTo }) =>
  [overKm && `above the due KM (${km(kmTo)})`, overDate && `after the due date (${formatDate(dueDateTo)})`]
    .filter(Boolean)
    .join(' and ')

// Older vehicle with no service history: assume past services followed the rule schedule,
// each done at the end of its due window. A service counts as past once its whole due window has ended before `asOf`.
// Returns how many services are past and the projection for the next one (null if the schedule has run out).
export function projectFromAge(rule, invoiceDate, asOf) {
  let projection = projectService(rule, invoiceDate, 1)
  let last = null
  let pastCount = 0
  while (projection && projection.dueDateTo < asOf) {
    pastCount++
    last = { ...projection, kmDoneAt: projection.kmTo, doneDate: projection.dueDateTo }
    projection = projectService(rule, invoiceDate, pastCount + 1, last)
  }
  if (projection && last && entryFor(rule, projection.serviceNo).base !== 'invoice') {
    projection = {
      ...projection,
      basis: `Estimated from the vehicle's age (no service history entered). Assumes the ${serviceLabel(pastCount)} was done on the rule schedule, around ${km(last.kmDoneAt)} on ${formatDate(last.doneDate)}. ${projection.basis}`,
    }
  }
  return { pastCount, projection }
}
