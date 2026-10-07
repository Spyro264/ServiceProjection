import { useState } from 'react'
import { formatDateRange, formatKmRange, lapseReason, serviceLabel, serviceTypeOf } from '../lib/projection.js'
import { SERVICE_CENTERS, closeOutcome, closeService, syncService } from '../lib/services.js'
import { loadJobCards, loadUnplanned, saveJobCards } from '../lib/storage.js'
import {
  DECISIONS,
  acceptUnplanned,
  closePushed,
  closeUnplanned,
  criticalName,
  dueRange,
  pushedTo,
  startPushed,
} from '../lib/unplanned.js'

const SERVICE_ITEMS = ['Oil Change', 'Air Filter']
const FILTERS = ['Pending', 'Ongoing']

// Job cards saved before the Pending/Ongoing flow used 'Open'.
const statusOf = (jc) => (jc.status === 'Open' ? 'Pending' : jc.status)

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

function FieldError({ id, error }) {
  return error ? (
    <p id={id} className="mt-1 text-xs font-medium text-neutral-900">
      {error}
    </p>
  ) : null
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-900">{value}</dd>
    </div>
  )
}

function PendingForm({ jobCard, onSubmit }) {
  const [items, setItems] = useState([])
  const [serviceDays, setServiceDays] = useState('')
  const [serviceCenter, setServiceCenter] = useState('')
  const [errors, setErrors] = useState({})

  function toggleItem(item) {
    setItems((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!serviceDays.trim()) nextErrors.serviceDays = 'Required'
    else if (!(Number(serviceDays) > 0)) nextErrors.serviceDays = 'Must be a number above 0'
    if (!serviceCenter) nextErrors.serviceCenter = 'Required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit({ items, serviceDays: Number(serviceDays), serviceCenter })
  }

  const id = (name) => `${name}-${jobCard.id}`

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-neutral-700">Service Items</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {SERVICE_ITEMS.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm text-neutral-900">
              <input
                type="checkbox"
                checked={items.includes(item)}
                onChange={() => toggleItem(item)}
                className="size-4 rounded border-neutral-300 accent-neutral-900"
              />
              {item}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id('serviceDays')} className="block text-sm font-medium text-neutral-700">
            Days Required for Service <span className="text-neutral-400">*</span>
          </label>
          <input
            id={id('serviceDays')}
            type="number"
            min={1}
            inputMode="numeric"
            value={serviceDays}
            onChange={(e) => {
              setServiceDays(e.target.value)
              setErrors((prev) => ({ ...prev, serviceDays: undefined }))
            }}
            placeholder="1"
            aria-invalid={Boolean(errors.serviceDays)}
            aria-describedby={errors.serviceDays ? `${id('serviceDays')}-error` : undefined}
            className={inputClass(errors.serviceDays)}
          />
          <FieldError id={`${id('serviceDays')}-error`} error={errors.serviceDays} />
        </div>
        <div>
          <label htmlFor={id('serviceCenter')} className="block text-sm font-medium text-neutral-700">
            Service Center <span className="text-neutral-400">*</span>
          </label>
          <select
            id={id('serviceCenter')}
            value={serviceCenter}
            onChange={(e) => {
              setServiceCenter(e.target.value)
              setErrors((prev) => ({ ...prev, serviceCenter: undefined }))
            }}
            aria-invalid={Boolean(errors.serviceCenter)}
            aria-describedby={errors.serviceCenter ? `${id('serviceCenter')}-error` : undefined}
            className={inputClass(errors.serviceCenter)}
          >
            <option value="">Select</option>
            {SERVICE_CENTERS.map((center) => (
              <option key={center} value={center}>
                {center}
              </option>
            ))}
          </select>
          <FieldError id={`${id('serviceCenter')}-error`} error={errors.serviceCenter} />
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
      >
        Submit
      </button>
    </form>
  )
}

// KM + date entered when the work is done. `card` is a planned job card or an unplanned request.
function DoneForm({ card, onSubmit }) {
  const [kmDoneAt, setKmDoneAt] = useState('')
  const [doneDate, setDoneDate] = useState('')
  const [errors, setErrors] = useState({})
  const id = (name) => `${name}-${card.id}`

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!kmDoneAt.trim()) nextErrors.kmDoneAt = 'Required'
    else if (!(Number(kmDoneAt) > 0)) nextErrors.kmDoneAt = 'Must be a number above 0'
    if (!doneDate) nextErrors.doneDate = 'Required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit({ kmDoneAt: Number(kmDoneAt), doneDate })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id('kmDoneAt')} className="block text-sm font-medium text-neutral-700">
            KM Service Done At <span className="text-neutral-400">*</span>
          </label>
          <input
            id={id('kmDoneAt')}
            type="number"
            min={1}
            inputMode="numeric"
            value={kmDoneAt}
            onChange={(e) => {
              setKmDoneAt(e.target.value)
              setErrors((prev) => ({ ...prev, kmDoneAt: undefined }))
            }}
            placeholder="980"
            aria-invalid={Boolean(errors.kmDoneAt)}
            aria-describedby={errors.kmDoneAt ? `${id('kmDoneAt')}-error` : undefined}
            className={inputClass(errors.kmDoneAt)}
          />
          <FieldError id={`${id('kmDoneAt')}-error`} error={errors.kmDoneAt} />
        </div>
        <div>
          <label htmlFor={id('doneDate')} className="block text-sm font-medium text-neutral-700">
            Service Done Date <span className="text-neutral-400">*</span>
          </label>
          <input
            id={id('doneDate')}
            type="date"
            value={doneDate}
            onChange={(e) => {
              setDoneDate(e.target.value)
              setErrors((prev) => ({ ...prev, doneDate: undefined }))
            }}
            aria-invalid={Boolean(errors.doneDate)}
            aria-describedby={errors.doneDate ? `${id('doneDate')}-error` : undefined}
            className={inputClass(errors.doneDate)}
          />
          <FieldError id={`${id('doneDate')}-error`} error={errors.doneDate} />
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
      >
        Submit
      </button>
    </form>
  )
}

const daysText = (days) => `${days} ${days === 1 ? 'day' : 'days'}`

function OngoingForm({ jobCard, onSubmit }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Detail label="Service Items" value={jobCard.items.length > 0 ? jobCard.items.join(', ') : '—'} />
        <Detail label="Service Center" value={jobCard.serviceCenter} />
        <Detail label="Days Required" value={daysText(jobCard.serviceDays)} />
      </dl>
      <DoneForm card={jobCard} onSubmit={onSubmit} />
    </div>
  )
}

function ItemList({ items }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            criticalName(item) ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

// Non-critical unplanned work that was pushed to this planned visit.
function PushedNote({ rows }) {
  return (
    <div className="border-b border-neutral-200 bg-neutral-50 p-5 text-sm">
      <p className="font-medium text-neutral-900">Also do on this visit (unplanned, pushed here)</p>
      {rows.map((r) => (
        <div key={r.id} className="mt-2">
          <span className="text-xs text-neutral-500">{r.unplannedNo}</span>
          <ItemList items={r.items} />
        </div>
      ))}
    </div>
  )
}

function UnplannedCard({ row, plannedJobCard, pushed, onAccept, onClose }) {
  return (
    <article className="flex flex-col rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-5">
        <div>
          <h2 className="text-base font-semibold">{row.unplannedNo}</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {row.regNo} · {row.model}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-semibold text-white">Unplanned</span>
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-neutral-950">{row.status}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-b border-neutral-200 p-5 text-sm">
        <div className="col-span-2">
          <dt className="text-xs text-neutral-500">Things to Do</dt>
          <dd>
            <ItemList items={row.items} />
          </dd>
        </div>
        <Detail label="Type" value={row.critical ? 'Critical' : 'Non-critical'} />
        <Detail label="Service Center" value={row.serviceCenter} />
        <Detail label="Days Required" value={daysText(row.serviceDays)} />
        <Detail
          label="Due Date"
          value={formatDateRange(row.dueDateFrom ? row : dueRange(row))}
        />
        {plannedJobCard && (
          <div className="col-span-2 rounded-lg bg-neutral-50 p-3">
            <Detail
              label="Planned service pulled forward (done on this visit)"
              value={`${plannedJobCard.jobCardNo} · ${serviceLabel(plannedJobCard.serviceNo)} · due ${formatKmRange(plannedJobCard)}, ${formatDateRange(plannedJobCard)}`}
            />
          </div>
        )}
      </dl>

      {pushed.length > 0 && <PushedNote rows={pushed} />}

      <div className="p-5">
        {row.status === 'Pending' ? (
          <button
            type="button"
            onClick={onAccept}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Accept
          </button>
        ) : (
          <DoneForm card={row} onSubmit={onClose} />
        )}
      </div>
    </article>
  )
}

function JobCard({ jobCard, pushed, onUpdate }) {
  const status = statusOf(jobCard)

  return (
    <article className="flex flex-col rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-5">
        <div>
          <h2 className="text-base font-semibold">{jobCard.jobCardNo}</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {jobCard.regNo} · {jobCard.model}
          </p>
        </div>
        <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-neutral-950">{status}</span>
      </div>

      <dl className="grid grid-cols-2 gap-4 border-b border-neutral-200 p-5 text-sm">
        <Detail
          label="Service"
          value={`${serviceLabel(jobCard.serviceNo)} · ${jobCard.serviceType ?? serviceTypeOf(jobCard.serviceNo)}`}
        />
        <Detail label="Due KM" value={formatKmRange(jobCard)} />
        <div className="col-span-2">
          <Detail label="Due Date" value={formatDateRange(jobCard)} />
        </div>
      </dl>

      {pushed.length > 0 && <PushedNote rows={pushed} />}

      <div className="p-5">
        {status === 'Pending' ? (
          <PendingForm
            jobCard={jobCard}
            onSubmit={(details) => onUpdate({ ...details, status: 'Ongoing', startedAt: new Date().toISOString() })}
          />
        ) : (
          <OngoingForm
            jobCard={jobCard}
            onSubmit={(details) => onUpdate(closeOutcome(jobCard, details))}
          />
        )}
      </div>
    </article>
  )
}

// Result of closing a planned job card, and what was projected next.
function closeMessage(jobCard, lateServiceNo, nextJobCard) {
  const result =
    jobCard.status === 'Completed'
      ? `${jobCard.jobCardNo} completed. Service was done within the due KM and date.`
      : `${jobCard.jobCardNo} lapsed. Service was done ${lapseReason(jobCard)}. ${serviceLabel(jobCard.serviceNo)} marked lapsed and this work recorded as the ${serviceLabel(lateServiceNo)}.`
  const next = nextJobCard
    ? ` ${serviceLabel(nextJobCard.serviceNo)} projected and job card ${nextJobCard.jobCardNo} created.`
    : ' Next service not projected: no master rule found for this vehicle.'
  return result + next
}

function JobCards() {
  const [jobCards, setJobCards] = useState(loadJobCards)
  const [unplanned, setUnplanned] = useState(loadUnplanned)
  const [filter, setFilter] = useState('Pending')
  const [message, setMessage] = useState('')

  function reload() {
    setJobCards(loadJobCards())
    setUnplanned(loadUnplanned())
  }

  function updateJobCard(id, changes) {
    const updated = jobCards.map((jc) => (jc.id === id ? { ...jc, ...changes } : jc))
    const jobCard = updated.find((jc) => jc.id === id)
    saveJobCards(updated)
    console.log(`Job card ${changes.status.toLowerCase()}`, jobCard)

    if (changes.status === 'Ongoing') {
      syncService(jobCard)
      startPushed(jobCard)
      setMessage('')
    } else {
      const { lateServiceNo, nextJobCard } = closeService(jobCard)
      const pushed = closePushed(jobCard)
      const alsoDone = pushed.length > 0 ? ` Unplanned ${pushed.map((r) => r.unplannedNo).join(', ')} done on this visit.` : ''
      setMessage(closeMessage(jobCard, lateServiceNo, nextJobCard) + alsoDone)
    }
    reload()
  }

  function handleAccept(row) {
    acceptUnplanned(row.id)
    setMessage(
      row.decision === DECISIONS.pulledForward
        ? `${row.unplannedNo} accepted. The planned ${row.plannedJobCardNo} is pulled forward and starts on the same visit.`
        : `${row.unplannedNo} accepted.`,
    )
    reload()
  }

  function handleClose(row, details) {
    const { plannedJobCard, pushed = [], lateServiceNo, nextJobCard } = closeUnplanned(row.id, details)
    const alsoDone = pushed.length > 0 ? ` Unplanned ${pushed.map((r) => r.unplannedNo).join(', ')} also done on this visit.` : ''
    setMessage(
      `${row.unplannedNo} completed.${plannedJobCard ? ` Planned service done early on the same visit: ${closeMessage(plannedJobCard, lateServiceNo, nextJobCard)}` : ''}${alsoDone}`,
    )
    reload()
  }

  // A planned job card pulled into an unplanned visit shows on that unplanned card instead.
  // Unplanned work pushed to a planned visit shows on that planned card instead.
  const cards = [
    ...unplanned.filter((r) => r.decision !== DECISIONS.pushed).map((row) => ({ kind: 'unplanned', status: row.status, row })),
    ...jobCards.filter((jc) => !jc.pulledForwardBy).map((jc) => ({ kind: 'planned', status: statusOf(jc), jc })),
  ]
  const visible = cards.filter((c) => c.status === filter)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Job Card</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A job card is created for the projected service whenever a vehicle is onboarded, and for every unplanned request.
        </p>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-neutral-200 bg-white p-1" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? 'bg-brand text-neutral-950' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {f} ({cards.filter((c) => c.status === f).length})
          </button>
        ))}
      </div>

      {message && (
        <p className="mb-6 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900">
          {message}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No {filter.toLowerCase()} job cards</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {filter === 'Pending'
              ? 'Onboard a vehicle to create its first job card.'
              : 'Submit a pending job card to start its service.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {visible.map((c) =>
            c.kind === 'unplanned' ? (
              <UnplannedCard
                key={c.row.id}
                row={c.row}
                plannedJobCard={
                  c.row.decision === DECISIONS.pulledForward ? jobCards.find((jc) => jc.id === c.row.plannedJobCardId) : null
                }
                pushed={c.row.decision === DECISIONS.pulledForward ? pushedTo(unplanned, c.row.plannedJobCardId) : []}
                onAccept={() => handleAccept(c.row)}
                onClose={(details) => handleClose(c.row, details)}
              />
            ) : (
              <JobCard
                key={c.jc.id}
                jobCard={c.jc}
                pushed={pushedTo(unplanned, c.jc.id)}
                onUpdate={(changes) => updateJobCard(c.jc.id, changes)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

export default JobCards
