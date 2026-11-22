// service_projection logic for the Demo page. Completing a service will be done from the job card (next step).

// Every service is INTERVAL_KM after the one before; services from the 2nd on get a NEXT_BUFFER_KM window either side.
export const INTERVAL_KM = 2500
export const NEXT_BUFFER_KM = 500

// How the next service is projected once a service is done (chosen when the projection starts):
// - prev_odo:        last serviced odo + interval (moves with the actual service)
// - prev_projection: previous projected due + interval (fixed, ignores the actual odo)
export const PROJECTION_BASES = [
  { value: 'prev_odo', label: 'Previous service (odo)', hint: 'Next due = last serviced odo + interval' },
  { value: 'prev_projection', label: 'Previous projection', hint: 'Next due = previous projected due + interval (fixed)' },
]

export function projectRow(serviceNo, due, lowerBuffer, upperBuffer, basis) {
  return {
    id: crypto.randomUUID(),
    service_no: serviceNo,
    due,
    lower_buffer_days: null,
    upper_buffer_days: null,
    lower_buffer_km: due - lowerBuffer,
    upper_buffer_km: due + upperBuffer,
    completed_at: null,
    projection_basis: basis,
    projection_status: 'draft',
    work_done_status: null,
    created_at: new Date().toISOString(),
  }
}

// Job card created whenever a service is projected: service no, due and buffer window of that projection.
// service_projection_id is the foreign key to the projection row. Every new job card is awaiting approval.
// spare_parts stays null until the spare parts module answers (the Demo page calls it for every new job card).
export function jobCardFor(row) {
  return {
    id: crypto.randomUUID(),
    service_projection_id: row.id,
    service_no: row.service_no,
    due: row.due,
    lower_buffer_km: row.lower_buffer_km,
    upper_buffer_km: row.upper_buffer_km,
    status: 'awaiting_approval',
    spare_parts: null,
    created_at: new Date().toISOString(),
  }
}

// All parts a job card covers. A card that took over late work lists what was done (done_parts) and what is
// still to do (pending_parts); other cards list their own service's parts (carried_parts is older data).
export function allPartsOf(card) {
  if (card.done_parts) return [...card.done_parts, ...(card.pending_parts ?? [])].map((p) => p.name)
  return [...(card.spare_parts ?? []), ...(card.carried_parts ?? []).map((p) => p.name)]
}

const tagged = (names, serviceNo) => names.map((name) => ({ name, from_service: serviceNo }))

// Late work: the open service is submitted at odo `done`, but `done` is already in (or past) the NEXT service's
// window. The odo is not saved as a completion — it only tells us where the work landed:
// - the submitted service and every service before the landing one → lapsed
// - the landing service (the one whose window `done` is in, or whose late range: after its window, before the next
//   window) → projected as the one open row; its job card goes for approval with the parts still to do.
// Returns the new rows, or null when `done` is before the next service's window (the normal completeService path).
export function landLateWork(rows, done) {
  const open = rows[rows.length - 1]
  const basis = open.projection_basis ?? 'prev_odo'
  const after = (row) => projectRow(row.service_no + 1, row.due + INTERVAL_KM, NEXT_BUFFER_KM, NEXT_BUFFER_KM, basis)

  let landing = after(open)
  if (done < landing.lower_buffer_km) return null

  const lapse = (row) => ({ ...row, projection_status: 'lapsed', work_done_status: 'lapsed' })
  const next = [...rows.slice(0, -1), lapse(open)]
  for (;;) {
    const following = after(landing)
    if (done < following.lower_buffer_km) break
    next.push(lapse(landing))
    landing = following
  }
  next.push(landing)
  return next
}

// Job cards for late work (rows from landLateWork). The submitted card and the cards of the services in between
// lapse. The landing service's card is the one open card: Done = the parts the technician did in the late visit
// (the submitted card's parts), To do = every part of each service after the submitted one up to and including the
// landing service — N parts for service N, nothing removed. It goes for approval like any job card.
export function lateWorkCards(cards, card, values, prevRows, nextRows, partsFor) {
  const done = card.done_parts ? [...card.done_parts, ...(card.pending_parts ?? [])] : tagged(card.spare_parts ?? [], card.service_no)
  const updated = cards.map((c) => (c.id === card.id ? { ...c, status: 'lapsed' } : c))

  const added = nextRows
    .filter((r) => !prevRows.some((p) => p.id === r.id))
    .map((r) => {
      const base = { ...jobCardFor(r), spare_parts: partsFor(r.service_no) }
      if (r.projection_status === 'lapsed') return { ...base, status: 'lapsed' }
      const pending = []
      for (let s = card.service_no + 1; s <= r.service_no; s += 1) pending.push(...tagged(partsFor(s), s))
      return {
        ...base,
        late_work: { ...values, from_service: card.service_no },
        done_parts: done,
        pending_parts: pending,
        status: 'awaiting_approval',
      }
    })
  return [...updated, ...added]
}

// Job cards after a normal submit (rows from completeService without the next projection). Any parts still to do
// on the card are now done.
// - done on time → the card is Completed with the completion values
// - after its window, before the next one → the card lapses and the new same-service row gets a Delayed Completion
//   card with the completion values and the same parts
export function jobCardsAfterCompletion(cards, card, values, prevRows, nextRows) {
  const finishedParts = card.done_parts ? { done_parts: [...card.done_parts, ...(card.pending_parts ?? [])], pending_parts: [] } : {}
  const ownRow = nextRows.find((r) => r.id === card.service_projection_id)
  if (ownRow.projection_status !== 'lapsed') {
    return cards.map((c) => (c.id === card.id ? { ...c, ...finishedParts, ...values, status: 'completed' } : c))
  }
  const updated = cards.map((c) => (c.id === card.id ? { ...c, status: 'lapsed' } : c))
  const added = nextRows
    .filter((r) => !prevRows.some((p) => p.id === r.id))
    .map((r) => ({
      ...jobCardFor(r),
      spare_parts: card.spare_parts,
      late_work: card.late_work,
      ...finishedParts,
      ...values,
      status: r.work_done_status === 'delayed_completion' ? 'delayed_completion' : 'lapsed',
    }))
  return [...updated, ...added]
}

// services table: one row per job card that closed (done / lapsed / delayed completion), with its parts count.
const SERVICE_STATUS = { completed: 'done', lapsed: 'lapsed', delayed_completion: 'delayed_completion' }
export function serviceRowsFor(closedCards) {
  return closedCards
    .filter((c) => SERVICE_STATUS[c.status])
    .map((c) => ({
      id: crypto.randomUUID(),
      service_no: c.service_no,
      job_card_id: c.id,
      parts_count: allPartsOf(c).length,
      status: SERVICE_STATUS[c.status],
      created_at: new Date().toISOString(),
    }))
}

// Closes the ongoing service at odo `done`, then (unless projectNext is false) projects the next one by the row's
// projection_basis.
// - inside the window                         → completed / done
// - past the window, before the next window   → this row lapsed / lapsed, plus a new row for the same service
//                                                marked completed / delayed completion at `done`
// - inside (or past) the next service's window → lapsed / lapsed, and the next service is checked the same way
export function completeService(rows, done, { projectNext = true } = {}) {
  const next = [...rows]
  let current = { ...next[next.length - 1] }
  next[next.length - 1] = current
  const basis = current.projection_basis ?? 'prev_odo'

  for (;;) {
    if (done <= current.upper_buffer_km) {
      Object.assign(current, { completed_at: done, projection_status: 'completed', work_done_status: 'done' })
      break
    }
    const following = projectRow(current.service_no + 1, current.due + INTERVAL_KM, NEXT_BUFFER_KM, NEXT_BUFFER_KM, basis)
    if (done < following.lower_buffer_km) {
      Object.assign(current, { projection_status: 'lapsed', work_done_status: 'lapsed' })
      next.push({
        ...current,
        id: crypto.randomUUID(),
        completed_at: done,
        projection_status: 'completed',
        work_done_status: 'delayed_completion',
        created_at: new Date().toISOString(),
      })
      break
    }
    Object.assign(current, { projection_status: 'lapsed', work_done_status: 'lapsed' })
    next.push(following)
    current = following
  }

  return projectNext ? projectNextService(next, done) : next
}

// Projects the service after the last row (the one just completed at odo `done`), by its projection_basis.
// Only one service is open at a time, so this runs only once the previous job card is fully done.
export function projectNextService(rows, done) {
  const current = rows[rows.length - 1]
  const basis = current.projection_basis ?? 'prev_odo'
  const nextDue = basis === 'prev_projection' ? current.due + INTERVAL_KM : done + INTERVAL_KM
  return [...rows, projectRow(current.service_no + 1, nextDue, NEXT_BUFFER_KM, NEXT_BUFFER_KM, basis)]
}
