// Dry run for the Service Parts Demo page: which spare parts plan misses parts?
// Both plans use the same projection (the Demo page's completeService logic, 35 services). They differ only in how
// the job card asks the spare parts module for parts:
// - range-wise: by the projected due odo → gets the parts of the fixed odo range that due falls in (none if no range)
// - static:     by the service number   → service N always gets service N's parts
import { INTERVAL_KM, NEXT_BUFFER_KM, PROJECTION_BASES, completeService, projectRow } from './demoProjection.js'
import { sparePartsFor } from './demoSpareParts.js'

export const SERVICE_COUNT = 35

// Range-wise plan: the fixed odo range each service's parts are assigned to.
// Service 1 = the entered window; service N = first due + (N − 1) × interval, ± NEXT_BUFFER_KM.
export function partRanges(due, lowerBuffer, upperBuffer) {
  return Array.from({ length: SERVICE_COUNT }, (_, i) => {
    const center = due + i * INTERVAL_KM
    const parts_count = sparePartsFor(i + 1).length // the parts assigned to this range up front
    return i === 0
      ? { service_no: 1, from: due - lowerBuffer, to: due + upperBuffer, parts_count }
      : { service_no: i + 1, from: center - NEXT_BUFFER_KM, to: center + NEXT_BUFFER_KM, parts_count }
  })
}

// Completion offsets the dry run accepts: from the window start (never before it) up to the last km before the
// next service's window (2,500 − 500 − 1 after due).
export function offsetLimits(lowerBuffer) {
  return { min: -Math.min(lowerBuffer, NEXT_BUFFER_KM), max: INTERVAL_KM - NEXT_BUFFER_KM - 1 }
}

// Projects SERVICE_COUNT services with the Demo page's logic; each service is completed at its due + its offset.
// Returns one entry per service: its projected due / window and where it was completed.
export function projectServices({ due, lowerBuffer, upperBuffer, basis, offset }) {
  // offset: one km for every service, or a list with each service's own km (index 0 = service 1).
  const offsetFor = (n) => (Array.isArray(offset) ? offset[n - 1] : offset)
  let rows = [projectRow(1, due, lowerBuffer, upperBuffer, basis)]
  for (let n = 1; n <= SERVICE_COUNT; n += 1) {
    const open = rows[rows.length - 1]
    rows = completeService(rows, open.due + offsetFor(n), { projectNext: n < SERVICE_COUNT })
  }
  const services = []
  for (const r of rows) {
    const s = services.find((x) => x.service_no === r.service_no)
    // A delayed completion is a second row for the same service: keep the projected due, take its completion.
    if (s) Object.assign(s, { completed_at: r.completed_at, work_done_status: r.work_done_status })
    else
      services.push({
        service_no: r.service_no,
        due: r.due,
        lower_buffer_km: r.lower_buffer_km,
        upper_buffer_km: r.upper_buffer_km,
        completed_at: r.completed_at,
        work_done_status: r.work_done_status,
      })
  }
  return services
}

// Range-wise plan: each job card gets the parts of the range its due falls in.
// A range is missed when the bike's job cards went past it without one landing in it; ranges beyond the last
// service's due are "not reached" (not counted as missed).
export function runRangeWise(services, ranges) {
  const cards = services.map((s) => {
    const range = ranges.find((r) => s.due >= r.from && s.due <= r.to) ?? null
    return {
      ...s,
      own_range: ranges[s.service_no - 1],
      parts_from: range ? range.service_no : null,
      parts: range ? sparePartsFor(range.service_no) : [],
    }
  })
  const lastDue = services[services.length - 1].due
  const rangeResults = ranges.map((r) => {
    const times = cards.filter((c) => c.parts_from === r.service_no).length
    const state = times > 0 ? 'given' : r.from > lastDue ? 'not_reached' : 'missed'
    return { ...r, parts_count: sparePartsFor(r.service_no).length, times, state }
  })
  return { cards, ranges: rangeResults, summary: summarize(cards, rangeResults) }
}

// Static plan: each job card asks with its service number.
export function runStatic(services) {
  const cards = services.map((s) => ({ ...s, parts_from: s.service_no, parts: sparePartsFor(s.service_no) }))
  const byService = Array.from({ length: SERVICE_COUNT }, (_, i) => {
    const n = i + 1
    const times = cards.filter((c) => c.parts_from === n).length
    return { service_no: n, parts_count: sparePartsFor(n).length, times, state: times > 0 ? 'given' : 'missed' }
  })
  return { cards, ranges: byService, summary: summarize(cards, byService) }
}

function summarize(cards, groups) {
  const sum = (list) => list.reduce((t, g) => t + g.parts_count, 0)
  const missed = groups.filter((g) => g.state === 'missed')
  return {
    parts_given: cards.reduce((t, c) => t + c.parts.length, 0),
    parts_missed: sum(missed),
    services_missed: missed.length,
    cards_without_parts: cards.filter((c) => c.parts_from == null).length,
    cards_with_other_service_parts: cards.filter((c) => c.parts_from != null && c.parts_from !== c.service_no).length,
    parts_given_twice: sum(groups.filter((g) => g.times > 1)),
    not_reached: groups.filter((g) => g.state === 'not_reached').length,
  }
}

// The full dry run for one input.
export function dryRun(input) {
  const services = projectServices(input)
  const ranges = partRanges(input.due, input.lowerBuffer, input.upperBuffer)
  return { services, rangeWise: runRangeWise(services, ranges), static: runStatic(services) }
}

// ---- Stress test ----------------------------------------------------------------------------------------------
// A scenario = where each of the 35 services is completed (km from its due). Every scenario is projected with both
// bases and run through both plans. Groups:
// - every service the same km from due: every km from the window start to the last km before the next window
// - only one service off its due (all others exactly on due): each service × every 50 km
// - mixed: each service its own random km (seeded, so the same runs every time)
export const STRESS_BASES = PROJECTION_BASES.map((b) => b.value)
export const PLANS = ['rangeWise', 'static']
const ONE_OFF_STEP_KM = 50
const RANDOM_RUNS = 500

// From `from` towards `to` in steps of `step` (sign taken from the direction), always ending at `to`.
function steps(from, to, step) {
  if (Math.sign(to - from) !== Math.sign(step) && from !== to) return []
  const out = []
  for (let v = from; step > 0 ? v < to : v > to; v += step) out.push(v)
  out.push(to)
  return out
}
const between = (from, to) => (to < from ? [] : steps(from, to, 1))

// Small seeded random generator (mulberry32) so random scenarios are the same on every run.
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function stressScenarios(lowerBuffer) {
  const { min, max } = offsetLimits(lowerBuffer)
  const same = (offset) => ({ offset, offsets: Array(SERVICE_COUNT).fill(offset) })
  const oneOff = (offsets) =>
    Array.from({ length: SERVICE_COUNT }, (_, i) => i + 1).flatMap((n) =>
      offsets.map((offset) => ({
        service_no: n,
        offset,
        offsets: Array.from({ length: SERVICE_COUNT }, (_, i) => (i === n - 1 ? offset : 0)),
      })),
    )
  const random = (hi, seedBase) =>
    Array.from({ length: RANDOM_RUNS }, (_, r) => {
      const rand = seeded(seedBase + r)
      return { run: r + 1, offsets: Array.from({ length: SERVICE_COUNT }, () => min + Math.floor(rand() * (hi - min + 1))) }
    })
  const late = NEXT_BUFFER_KM // "slightly late" = inside the ±500 window (services 2–35)
  const groups = [
    { key: 'all_early', limits: [min, -1], scenarios: between(min, -1).map(same) },
    { key: 'all_on_due', limits: [0, 0], scenarios: [same(0)] },
    { key: 'all_slightly_late', limits: [1, late], scenarios: between(1, late).map(same) },
    { key: 'all_very_late', limits: [late + 1, max], scenarios: between(late + 1, max).map(same) },
    { key: 'one_early', limits: [min, -ONE_OFF_STEP_KM], scenarios: min < 0 ? oneOff(steps(-ONE_OFF_STEP_KM, min, -ONE_OFF_STEP_KM).filter((o) => o >= min)) : [] },
    { key: 'one_slightly_late', limits: [ONE_OFF_STEP_KM, late], scenarios: oneOff(steps(ONE_OFF_STEP_KM, late, ONE_OFF_STEP_KM)) },
    { key: 'one_very_late', limits: [late + ONE_OFF_STEP_KM, max], scenarios: oneOff(steps(late + ONE_OFF_STEP_KM, max, ONE_OFF_STEP_KM)) },
    { key: 'mixed_in_window', limits: [min, late], scenarios: random(late, 1000) },
    { key: 'mixed_any', limits: [min, max], scenarios: random(max, 5000) },
  ]
  return groups.filter((g) => g.scenarios.length > 0)
}

// Runs every stress scenario. Each scenario gets results[basis][plan] = { parts_missed, cards_without_parts,
// missed_services }. Totals are per group and overall: how many scenarios missed parts, and the worst one.
export function stress({ due, lowerBuffer, upperBuffer }) {
  const ranges = partRanges(due, lowerBuffer, upperBuffer)
  const emptyTotals = () =>
    Object.fromEntries(STRESS_BASES.map((b) => [b, Object.fromEntries(PLANS.map((p) => [p, { with_miss: 0, worst: null }]))]))
  const overall = emptyTotals()
  let count = 0

  const groups = stressScenarios(lowerBuffer).map((group) => {
    const totals = emptyTotals()
    for (const scenario of group.scenarios) {
      count += 1
      scenario.results = {}
      for (const basis of STRESS_BASES) {
        const services = projectServices({ due, lowerBuffer, upperBuffer, basis, offset: scenario.offsets })
        const runs = { rangeWise: runRangeWise(services, ranges), static: runStatic(services) }
        scenario.results[basis] = {}
        for (const plan of PLANS) {
          const r = {
            parts_missed: runs[plan].summary.parts_missed,
            cards_without_parts: runs[plan].summary.cards_without_parts,
            missed_services: runs[plan].ranges.filter((x) => x.state === 'missed').map((x) => x.service_no),
          }
          scenario.results[basis][plan] = r
          for (const t of [totals[basis][plan], overall[basis][plan]]) {
            if (r.parts_missed > 0) t.with_miss += 1
            if (r.parts_missed > (t.worst?.parts_missed ?? 0)) t.worst = { parts_missed: r.parts_missed, group: group.key, scenario }
          }
        }
      }
    }
    return { ...group, totals }
  })
  return { count, groups, totals: overall }
}
