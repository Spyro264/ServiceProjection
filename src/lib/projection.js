import { addDays, daysBetween, formatDate } from './dates.js'

// A rule has a name and an ordered `schedule` of services:
// { serviceNo, type, days, km, daysLower, daysUpper, kmLower, kmUpper, base, recursive, count, daysInterval, kmInterval }
// serviceNo is the entry's position (1, 2, 3 ...). type is a free-text label ("Free", "PMS" ...); the 1st is always "Free".
// days / km are the ideal point ("Service Due After" days / km); the buffers widen it into the due window
// daysMin–daysMax / kmMin–kmMax (see windowOf).
// Every entry's own service is a fixed point counted from the invoice date (odo 0), e.g. 2nd at 2,500 km / day 60.
// A later entry can be recursive: its own service, then `count` repeats, each daysInterval / kmInterval (with the same
// buffers) after the previous service. `base` says what the repeats are counted from: 'actual' (last service odo / date)
// or 'projected' (the previous projected service's ideal km / date). After the last entry, nothing more is projected.
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

const isRecursive = (entry) => entry.base !== 'invoice' && entry.recursive

// How many service slots an entry takes: its own service plus `count` repeats when recursive.
export const slotCountOf = (entry) => (isRecursive(entry) ? entry.count + 1 : 1)

// Due window of each repeat: the intervals with the entry's buffers. Rules saved before the intervals repeat the entry's own window.
const repeatWindowOf = (entry) =>
  entry.kmInterval == null
    ? entry
    : windowOf({ ...entry, days: entry.daysInterval ?? entry.days, km: entry.kmInterval })

// The schedule entry for a service number and whether that service is one of its repeats,
// or undefined once the schedule has run out.
function slotFor(rule, serviceNo) {
  let slotsBefore = 0
  for (const entry of scheduleOf(rule)) {
    const first = slotsBefore + 1
    slotsBefore += slotCountOf(entry)
    if (serviceNo <= slotsBefore) return { entry, repeat: serviceNo > first, repeatNo: serviceNo - first }
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

const baseText = { invoice: 'invoice date', actual: 'last service', projected: "projected service's ideal point" }

const rangeText = (entry) => `${entry.daysMin}–${entry.daysMax} days / ${kmRange(entry.kmMin, entry.kmMax)}`

// What an entry is counted from and how it repeats,
// e.g. "From invoice date · then 5 repeats, each +75–105 days / 2,000–3,000 km from last service".
export function entryDetail(entry) {
  const from = `From ${baseText.invoice}`
  if (!isRecursive(entry)) return from
  const repeats = entry.count === Infinity ? 'then repeats' : `then ${entry.count} repeat${entry.count === 1 ? '' : 's'}`
  return `${from} · ${repeats}, each +${rangeText(repeatWindowOf(entry))} from ${baseText[entry.base]}`
}

export const serviceTypeOf = (serviceNo, rule) => slotFor(rule, serviceNo)?.entry.type ?? 'PMS'

// Counted from the invoice date: a fixed ladder that never moves, even after a lapse.
// kmIdeal / dueDateIdeal (the point the buffers are around) are kept so a repeat can count from them.
// Rules saved before the buffers have no ideal point.
function projectFromInvoice(entry, invoiceDate, serviceNo) {
  return {
    serviceNo,
    serviceType: entry.type,
    ...(entry.days != null && { kmIdeal: entry.km, dueDateIdeal: addDays(invoiceDate, entry.days) }),
    kmFrom: entry.kmMin,
    kmTo: entry.kmMax,
    dueDateFrom: addDays(invoiceDate, entry.daysMin),
    dueDateTo: addDays(invoiceDate, entry.daysMax),
    basis: `${entry.type} service from the rule: ${rangeText(entry)} after the invoice date (${formatDate(invoiceDate)}).`,
  }
}

// A repeat is counted from the previous service — its actual odo / date, or its projected ideal km / date (`base`) —
// using the interval window. With no ideal point to use (e.g. last service entered at onboarding, or a service projected
// before ideal points were saved), the actual service is used.
function projectRepeat({ entry, repeatNo }, serviceNo, last) {
  const window = repeatWindowOf(entry)
  const fromProjected = entry.base === 'projected' && last.kmIdeal != null
  const baseKm = fromProjected ? last.kmIdeal : last.kmDoneAt
  const baseDate = fromProjected ? last.dueDateIdeal : last.doneDate
  const idealKm = entry.kmInterval ?? entry.km
  const idealDays = entry.daysInterval ?? entry.days
  const which = ` repeat ${repeatNo}${entry.count === Infinity ? '' : ` of ${entry.count}`}`
  return {
    serviceNo,
    serviceType: entry.type,
    ...(idealKm != null && idealDays != null && { kmIdeal: baseKm + idealKm, dueDateIdeal: addDays(baseDate, idealDays) }),
    kmFrom: baseKm + window.kmMin,
    kmTo: baseKm + window.kmMax,
    dueDateFrom: addDays(baseDate, window.daysMin),
    dueDateTo: addDays(baseDate, window.daysMax),
    basis: `${entry.type}${which} from the ${fromProjected ? "previous projected service's ideal point" : 'last service'} (${km(baseKm)} on ${formatDate(baseDate)}) + ${rangeText(window)}.`,
  }
}

// `last` is the most recent service ({ kmDoneAt, doneDate }, plus its projected kmIdeal / dueDateIdeal when known);
// only repeats use it. Returns null once the rule's schedule has run out.
export function projectService(rule, invoiceDate, serviceNo, last) {
  const slot = slotFor(rule, serviceNo)
  if (!slot) return null
  return slot.repeat ? projectRepeat(slot, serviceNo, last) : projectFromInvoice(slot.entry, invoiceDate, serviceNo)
}

// Late work for a lapsed service takes the first later slot it has not also passed (passed = done above that slot's
// due KM or after its due date, the same test as a lapse), e.g. 2nd lapsed and done at 10,000 km: the 3rd, 4th …
// lapse too and the work takes the slot whose window it reaches. A passed slot is assumed done at its ideal point
// (window end for rules saved before ideal points) so the slots after it can be projected.
// Returns { skipped, late }: the passed slots' projections and the slot the work takes (null once the schedule runs out).
export function placeLateWork(rule, invoiceDate, lapsed, { kmDoneAt, doneDate }) {
  const skipped = []
  let prev = lapsed
  for (;;) {
    const last = { ...prev, kmDoneAt: prev.kmIdeal ?? prev.kmTo, doneDate: prev.dueDateIdeal ?? prev.dueDateTo }
    const next = projectService(rule, invoiceDate, prev.serviceNo + 1, last)
    if (!next || (kmDoneAt <= next.kmTo && doneDate <= next.dueDateTo)) return { skipped, late: next }
    skipped.push({ ...next, overKm: kmDoneAt > next.kmTo, overDate: doneDate > next.dueDateTo })
    prev = next
  }
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

// Where `asOf` falls in a service's due window by date (there is no live odometer): before it opens, inside it, or past it.
export function dueTiming({ dueDateFrom, dueDateTo }, asOf) {
  if (asOf < dueDateFrom) return { state: 'upcoming', days: daysBetween(asOf, dueDateFrom) }
  if (asOf <= dueDateTo) return { state: 'due', days: daysBetween(asOf, dueDateTo) }
  return { state: 'overdue', days: daysBetween(dueDateTo, asOf) }
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
  if (projection && last && slotFor(rule, projection.serviceNo).repeat) {
    projection = {
      ...projection,
      basis: `Estimated from the vehicle's age (no service history entered). Assumes the ${serviceLabel(pastCount)} was done on the rule schedule, around ${km(last.kmDoneAt)} on ${formatDate(last.doneDate)}. ${projection.basis}`,
    }
  }
  return { pastCount, projection }
}
