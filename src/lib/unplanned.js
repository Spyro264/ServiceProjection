import { addDays, daysBetween, formatDate, today } from './dates.js'
import { serviceLabel } from './projection.js'
import { closeOutcome, closeService, syncService } from './services.js'
import { loadJobCards, loadUnplanned, saveJobCards, saveUnplanned } from './storage.js'

// Picking one of these makes the request critical. Anything typed by hand is non-critical.
export const CRITICAL_SERVICES = [
  'Brake Failure',
  'Brake Pad Replacement',
  'Puncture Repair',
  'Tyre Replacement',
  'Battery Replacement',
  'Self-Start Not Working',
  'Chain & Sprocket Replacement',
  'Clutch Repair',
  'Engine Overheating',
  'Engine Oil Leak',
  'Fuel Leak',
  'Headlight / Indicator Failure',
  'Wiring / Electrical Fault',
  'Throttle Cable Repair',
  'Suspension Repair',
  'Accident Damage Repair',
]

// The planned service is "near" when its due date starts within this many days (no odometer check yet).
export const NEAR_DAYS = 20

export const DECISIONS = {
  separate: 'Separate',
  pulledForward: 'Planned Pulled Forward',
  pushed: 'Pushed to Planned',
}

// Due from the day the request is raised, to that day + the days required.
export function dueRange({ serviceDays, createdAt }) {
  const raisedOn = new Date(createdAt).toLocaleDateString('en-CA')
  return { dueDateFrom: raisedOn, dueDateTo: addDays(raisedOn, serviceDays) }
}

// Returns the list's spelling when the text matches a critical service, else null.
export const criticalName = (text) =>
  CRITICAL_SERVICES.find((name) => name.toLowerCase() === text.trim().toLowerCase()) ?? null

// The vehicle's planned job card that is still Pending (possibly already pulled into an unplanned visit).
const pendingPlannedJobCard = (jobCards, vehicleId) =>
  jobCards.find((jc) => jc.vehicleId === vehicleId && (jc.status === 'Pending' || jc.status === 'Open'))

// Raises an unplanned request (status Pending) and decides how it fits with the planned service:
// - critical + planned near → planned is pulled forward, both done on one visit
// - non-critical + planned near → pushed to the planned visit
// - planned not near → done on its own
// A critical request whose planned service is already pulled into another unplanned visit is done on its own;
// non-critical work pushed to that planned service rides along with the visit.
export function raiseUnplanned(vehicle, { items, serviceDays, serviceCenter }) {
  const jobCards = loadJobCards()
  const unplanned = loadUnplanned()
  const now = new Date().toISOString()
  const critical = items.some((item) => criticalName(item))
  const planned = pendingPlannedJobCard(jobCards, vehicle.id)
  const daysToPlanned = planned ? daysBetween(today(), planned.dueDateFrom) : null
  const near = Boolean(planned) && daysToPlanned <= NEAR_DAYS
  const decision =
    !near || (critical && planned.pulledForwardBy)
      ? DECISIONS.separate
      : critical
        ? DECISIONS.pulledForward
        : DECISIONS.pushed

  const row = {
    id: crypto.randomUUID(),
    unplannedNo: `UP-${String(unplanned.length + 1).padStart(4, '0')}`,
    vehicleId: vehicle.id,
    regNo: vehicle.regNo,
    model: vehicle.model,
    items,
    critical,
    serviceDays,
    serviceCenter,
    decision,
    ...(decision !== DECISIONS.separate && {
      plannedJobCardId: planned.id,
      plannedJobCardNo: planned.jobCardNo,
      plannedServiceNo: planned.serviceNo,
      plannedDueDateFrom: planned.dueDateFrom,
    }),
    status: 'Pending',
    ...dueRange({ serviceDays, createdAt: now }),
    createdAt: now,
  }
  saveUnplanned([row, ...unplanned])

  // The planned job card now belongs to this visit, so it can't be started on its own.
  if (decision === DECISIONS.pulledForward) {
    saveJobCards(jobCards.map((jc) => (jc.id === planned.id ? { ...jc, pulledForwardBy: row.unplannedNo } : jc)))
  }

  console.log('Unplanned request raised', row)
  return { row, daysToPlanned }
}

export function describeDecision({ row, daysToPlanned }) {
  const planned = row.plannedJobCardNo
    ? `the planned ${serviceLabel(row.plannedServiceNo)} (${row.plannedJobCardNo}) is due from ${formatDate(row.plannedDueDateFrom)}${
        daysToPlanned < 0 ? ', its due window has already started' : `, ${daysToPlanned} ${daysToPlanned === 1 ? 'day' : 'days'} away`
      }`
    : null
  const type = row.critical ? 'Critical' : 'Non-critical'
  if (row.decision === DECISIONS.pulledForward)
    return `${row.unplannedNo} raised. ${type}, and ${planned}, so the planned service is pulled forward and both will be done on the same visit once ${row.unplannedNo} is accepted.`
  if (row.decision === DECISIONS.pushed)
    return `${row.unplannedNo} raised. ${type}, and ${planned}, so this work is pushed to the planned visit and will be done with ${row.plannedJobCardNo}.`
  if (daysToPlanned !== null && daysToPlanned <= NEAR_DAYS)
    return `${row.unplannedNo} raised. ${type}. The planned service is already pulled into another unplanned visit, so this will be done on its own. Accept it on the Job Card page to start.`
  return `${row.unplannedNo} raised. ${type}, and no planned service is due within ${NEAR_DAYS} days, so it will be done on its own. Accept it on the Job Card page to start.`
}

function updateUnplanned(id, changes) {
  const rows = loadUnplanned().map((r) => (r.id === id ? { ...r, ...changes } : r))
  saveUnplanned(rows)
  return rows.find((r) => r.id === id)
}

// Pending → Ongoing.
// A pulled-forward planned job card starts on the same visit.
export function acceptUnplanned(id) {
  const now = new Date().toISOString()
  const row = updateUnplanned(id, { status: 'Ongoing', acceptedAt: now })
  if (row.decision === DECISIONS.pulledForward) {
    const jobCards = loadJobCards().map((jc) =>
      jc.id === row.plannedJobCardId
        ? { ...jc, items: [], serviceDays: row.serviceDays, serviceCenter: row.serviceCenter, status: 'Ongoing', startedAt: now }
        : jc,
    )
    saveJobCards(jobCards)
    const plannedJobCard = jobCards.find((jc) => jc.id === row.plannedJobCardId)
    syncService(plannedJobCard)
    startPushed(plannedJobCard)
  }
  console.log('Unplanned request accepted', row)
  return row
}

// Ongoing → Completed. A pulled-forward planned job card is closed with the same km and date,
// as its own record in the services table, and the next planned service is projected.
// Non-critical work pushed to that planned service is done on the same visit too.
// Returns { row, plannedJobCard, pushed, lateServiceNo, nextJobCard }.
export function closeUnplanned(id, { kmDoneAt, doneDate }) {
  const row = updateUnplanned(id, { kmDoneAt, doneDate, status: 'Completed', closedAt: new Date().toISOString() })
  console.log('Unplanned request completed', row)
  if (row.decision !== DECISIONS.pulledForward) return { row }

  const jobCards = loadJobCards().map((jc) =>
    jc.id === row.plannedJobCardId ? { ...jc, ...closeOutcome(jc, { kmDoneAt, doneDate }) } : jc,
  )
  saveJobCards(jobCards)
  const plannedJobCard = jobCards.find((jc) => jc.id === row.plannedJobCardId)
  const pushed = closePushed(plannedJobCard)
  return { row, plannedJobCard, pushed, ...closeService(plannedJobCard) }
}

// Non-critical work pushed to a planned visit follows that planned job card.
export const pushedTo = (rows, plannedJobCardId) =>
  rows.filter((r) => r.decision === DECISIONS.pushed && r.plannedJobCardId === plannedJobCardId && r.status !== 'Completed')

export function startPushed(plannedJobCard) {
  const ids = pushedTo(loadUnplanned(), plannedJobCard.id).map((r) => r.id)
  saveUnplanned(
    loadUnplanned().map((r) => (ids.includes(r.id) ? { ...r, status: 'Ongoing', acceptedAt: plannedJobCard.startedAt } : r)),
  )
}

export function closePushed(plannedJobCard) {
  const pushed = pushedTo(loadUnplanned(), plannedJobCard.id)
  const ids = pushed.map((r) => r.id)
  const { kmDoneAt, doneDate, closedAt } = plannedJobCard
  saveUnplanned(loadUnplanned().map((r) => (ids.includes(r.id) ? { ...r, kmDoneAt, doneDate, closedAt, status: 'Completed' } : r)))
  return pushed
}
