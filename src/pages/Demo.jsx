import { useEffect, useRef, useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDate, today } from '../lib/dates.js'
import { logTable } from '../lib/log.js'
import { INTERVAL_KM, NEXT_BUFFER_KM, PROJECTION_BASES, allPartsOf, completeService, jobCardFor, jobCardsAfterCompletion, landLateWork, lateWorkCards, projectNextService, projectRow, serviceRowsFor } from '../lib/demoProjection.js'
import { callSparePartsModule, sparePartsFor } from '../lib/demoSpareParts.js'
import {
  loadDemoJobCards,
  loadDemoServices,
  loadServiceProjection,
  saveDemoJobCards,
  saveDemoServices,
  saveServiceProjection,
} from '../lib/storage.js'

// Demo only: a projected row stays draft for DRAFT_MS.
const DRAFT_MS = 5000

const statusLabels = {
  draft: 'Draft',
  ongoing: 'Ongoing',
  lapsed: 'Lapsed',
  completed: 'Completed',
  done: 'Done',
  delayed_completion: 'Delayed Completion',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  parts_pending: 'Parts Pending',
}

// Ids are UUIDs; tables show the first 8 characters (full id on hover).
const shortId = (id) => (id ? id.slice(0, 8) : '—')

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 disabled:bg-neutral-100 disabled:text-neutral-500 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const fields = [
  { name: 'due', label: 'Due Point (km)', placeholder: '750' },
  { name: 'lowerBuffer', label: 'Lower Buffer (km)', placeholder: '250' },
  { name: 'upperBuffer', label: 'Upper Buffer (km)', placeholder: '250' },
]

const emptyForm = { due: '', lowerBuffer: '', upperBuffer: '', basis: 'prev_odo' }

const km = (value) => (value == null ? '—' : value.toLocaleString('en-IN'))

function validate(form) {
  const errors = {}
  const num = (name) => Number(form[name])
  const isWhole = (name) => form[name].trim() !== '' && Number.isInteger(num(name)) && num(name) >= 0

  for (const name of ['due', 'lowerBuffer', 'upperBuffer']) {
    if (form[name].trim() === '') errors[name] = 'Required'
    else if (!isWhole(name)) errors[name] = 'Enter a whole number of km'
  }
  if (!errors.due && num('due') <= 0) errors.due = 'Must be more than 0'
  if (!errors.due && !errors.lowerBuffer && num('lowerBuffer') > num('due')) errors.lowerBuffer = 'Cannot be more than the due point'
  return errors
}

// One accent colour per table / card column (kept away from the status badge colours: green, red, orange, yellow).
const tones = {
  projection: {
    box: 'border-blue-200',
    head: 'border-blue-200 bg-blue-50 text-blue-900',
    dot: 'bg-blue-500',
    thead: 'bg-blue-50/60 text-blue-900/70',
  },
  jobCard: {
    box: 'border-violet-200',
    head: 'border-violet-200 bg-violet-50 text-violet-900',
    dot: 'bg-violet-500',
    thead: 'bg-violet-50/60 text-violet-900/70',
    group: 'border-violet-200 bg-violet-50/70',
    summary: 'text-violet-900 hover:bg-violet-100/70',
    tile: 'border-t-violet-500',
  },
  services: {
    box: 'border-teal-200',
    head: 'border-teal-200 bg-teal-50 text-teal-900',
    dot: 'bg-teal-500',
    thead: 'bg-teal-50/60 text-teal-900/70',
  },
  technician: {
    dot: 'bg-fuchsia-500',
    group: 'border-fuchsia-200 bg-fuchsia-50/70',
    summary: 'text-fuchsia-900 hover:bg-fuchsia-100/70',
    tile: 'border-t-fuchsia-500',
  },
}

const cardButton =
  'rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

// One job card: service no, due at, buffer window, status, and an optional button.
// Parts on a card that took over late work: what was done in the visit, and what the skipped services still need.
function LateWorkParts({ card }) {
  const chip = (part, tone) => (
    <li key={`${part.from_service}-${part.name}`} title={`From service ${part.from_service}`} className={`rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${tone}`}>
      {part.name}
      {/* Tagged names like "Air filter (S7)" already say their service; untagged ones (Engine oil) get it here. */}
      {!part.name.endsWith(`(S${part.from_service})`) && <span className="font-semibold"> · S{part.from_service}</span>}
    </li>
  )
  return (
    <div className="mt-2 space-y-2.5">
      <div>
        <p className="text-xs text-neutral-600">
          Done <span className="text-neutral-400">({card.done_parts.length})</span>
          {card.late_work && card.pending_parts.length > 0 && (
            <span className="text-neutral-400">
              {' '}
              — service {card.late_work.from_service} parts, late visit at {km(card.late_work.service_completed_at)} km
            </span>
          )}
        </p>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {card.done_parts.map((p) => chip(p, 'bg-green-50 text-green-800 ring-green-200'))}
        </ul>
      </div>
      {card.pending_parts.length > 0 && (
        <div>
          <p className="text-xs text-neutral-600">
            To do <span className="text-neutral-400">({card.pending_parts.length})</span>
            <span className="text-neutral-400"> — services after the late visit, up to this one</span>
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {card.pending_parts.map((p) => chip(p, 'bg-red-50 text-red-800 ring-red-200'))}
          </ul>
        </div>
      )}
    </div>
  )
}

function JobCardTile({ card, action, children, tone }) {
  const calling = card.spare_parts == null
  return (
    <li className={`rounded-xl border border-t-4 border-neutral-200 bg-white p-4 shadow-sm ${tone.tile}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Job Card</p>
        <p className="text-sm font-semibold text-neutral-900">Service {card.service_no}</p>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Due At</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">{km(card.due)} km</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-neutral-500">Buffer</dt>
          <dd className="tabular-nums text-neutral-900">
            {km(card.lower_buffer_km)} – {km(card.upper_buffer_km)} km
          </dd>
        </div>
      </dl>

      {calling ? (
        <div role="status" className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-700">
            <span className="rounded-md bg-white px-1.5 py-0.5 ring-1 ring-neutral-300">Job Card</span>
            <span className="relative h-2 flex-1" aria-hidden="true">
              <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-400" />
              <span className="absolute top-0 size-2 rounded-full bg-brand ring-1 ring-neutral-900 motion-safe:animate-[jc-travel_1s_ease-in-out_infinite]" />
            </span>
            <span className="rounded-md bg-brand px-1.5 py-0.5 ring-1 ring-neutral-900 motion-safe:animate-pulse">Spare Parts</span>
          </div>
          <p className="mt-2 text-xs text-neutral-600">Calling spare parts module for service {card.service_no}…</p>
        </div>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3 motion-safe:animate-[jc-fade-in_300ms_ease-out]">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Spare Parts <span className="font-normal text-neutral-400">({allPartsOf(card).length})</span>
          </p>
          {card.done_parts ? (
            <LateWorkParts card={card} />
          ) : allPartsOf(card).length === 0 ? (
            <p className="mt-1.5 text-xs text-neutral-500">No spare parts mapped for this service.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {card.spare_parts.map((part) => (
                <li key={part} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-800">
                  {part}
                </li>
              ))}
              {/* Older data: parts carried over from lapsed services. */}
              {(card.carried_parts ?? []).map((part) => (
                <li
                  key={`carried-${part.name}`}
                  title={`Carried over from lapsed service ${part.from_service}`}
                  className="rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-800 ring-1 ring-inset ring-red-200"
                >
                  {part.name} <span className="font-semibold">· S{part.from_service}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {card.service_completed_date && (
        <dl className="mt-3 space-y-2 border-t border-neutral-100 pt-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Completed Date</dt>
            <dd className="tabular-nums text-neutral-900">{formatDate(card.service_completed_date)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Completed At</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{km(card.service_completed_at)} km</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Invoice</dt>
            <dd className="truncate text-neutral-900">{card.service_invoice || '—'}</dd>
          </div>
        </dl>
      )}

      {children}

      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge status={statusLabels[card.status ?? 'awaiting_approval']} />
        {action}
      </div>
    </li>
  )
}

// Job cards grouped by service number, one collapsible per service (open by default), Service 1 first.
// Inside a group the cards stay in the order they were created (e.g. Lapsed, then Delayed Completion).
function ServiceGroups({ cards, renderCard, tone }) {
  const groups = []
  for (const card of cards) {
    const group = groups.find((g) => g.serviceNo === card.service_no)
    if (group) group.cards.push(card)
    else groups.push({ serviceNo: card.service_no, cards: [card] })
  }
  groups.sort((a, b) => a.serviceNo - b.serviceNo)

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <details key={g.serviceNo} open className={`group rounded-xl border ${tone.group}`}>
          <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden ${tone.summary}`}>
            <span>
              Service {g.serviceNo}{' '}
              <span className="font-normal text-neutral-400">
                ({g.cards.length} job card{g.cards.length === 1 ? '' : 's'})
              </span>
            </span>
            <svg
              className="size-4 opacity-60 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <ul className="space-y-3 px-2 pb-2">{g.cards.map(renderCard)}</ul>
        </details>
      ))}
    </div>
  )
}

const cardInput = (error) =>
  `mt-1 block w-full rounded-md border bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

// Technician fills these on an in-progress job card, then submits it.
function TechnicianCompletion({ card, onSubmit }) {
  const [values, setValues] = useState({ date: '', km: '', invoice: '' })
  const [errors, setErrors] = useState({})
  const id = (name) => `${name}-${card.id}`

  function validateCompletion() {
    const e = {}
    if (values.date === '') e.date = 'Required'
    else if (values.date > today()) e.date = 'Cannot be in the future'
    const n = Number(values.km)
    if (values.km.trim() === '') e.km = 'Required'
    else if (!Number.isInteger(n) || n < 0) e.km = 'Enter a whole number of km'
    else if (card.late_work && n < card.late_work.service_completed_at)
      e.km = `Before the late visit (${km(card.late_work.service_completed_at)} km)`
    else if (n < card.lower_buffer_km) e.km = `Before the window start (${km(card.lower_buffer_km)} km)`
    return e
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCompletion()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }
    onSubmit({
      service_completed_date: values.date,
      service_completed_at: Number(values.km),
      service_invoice: values.invoice.trim() || null,
    })
  }

  const field = (name, label, input, required) => (
    <div>
      <label htmlFor={id(name)} className="block text-xs font-medium text-neutral-700">
        {label} {required ? <span className="text-neutral-400">*</span> : <span className="font-normal text-neutral-400">(optional)</span>}
      </label>
      {input}
      {errors[name] && (
        <p id={`${id(name)}-error`} className="mt-1 text-xs font-medium text-neutral-900">
          {errors[name]}
        </p>
      )}
    </div>
  )
  const inputProps = (name) => ({
    id: id(name),
    value: values[name],
    onChange: (e) => {
      setValues((prev) => ({ ...prev, [name]: e.target.value }))
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    },
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${id(name)}-error` : undefined,
    className: cardInput(errors[name]),
  })

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
      {field('date', 'Service Completed Date', <input type="date" max={today()} {...inputProps('date')} />, true)}
      {field(
        'km',
        'Service Completed At (km)',
        <input type="number" inputMode="numeric" min="0" placeholder="800" {...inputProps('km')} />,
        true,
      )}
      {field('invoice', 'Service Invoice', <input type="text" placeholder="Invoice no." {...inputProps('invoice')} />, false)}
      <div className="flex justify-end">
        <button type="submit" className={cardButton}>
          Submit
        </button>
      </div>
    </form>
  )
}

function Demo() {
  const [rows, setRows] = useState(loadServiceProjection)
  const [jobCards, setJobCards] = useState(loadDemoJobCards)
  const [services, setServices] = useState(loadDemoServices)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  // The open service is the last row while it is draft or ongoing.
  const last = rows[rows.length - 1]
  const active = last && (last.projection_status === 'draft' || last.projection_status === 'ongoing') ? last : null
  const isDraft = active?.projection_status === 'draft'
  // Once started the form stays locked.
  const started = rows.length > 0
  const shown = active ?? last

  // A projected row turns ongoing DRAFT_MS after it was created (also after a reload).
  useEffect(() => {
    const draft = rows.find((r) => r.projection_status === 'draft')
    if (!draft) return undefined
    const wait = Math.max(0, Date.parse(draft.created_at) + DRAFT_MS - Date.now())
    const timer = setTimeout(() => {
      const next = rows.map((r) => (r.id === draft.id ? { ...r, projection_status: 'ongoing' } : r))
      saveServiceProjection(next)
      logTable(`Service ${draft.service_no} is now ongoing`, next.find((r) => r.id === draft.id))
      logTable('service_projection', next)
      setRows(next)
    }, wait)
    return () => clearTimeout(timer)
  }, [rows])

  // Every job card calls the spare parts module with its service number; the parts are saved on the job card.
  // Runs for any job card still waiting for parts (so a reload mid-call calls again); calling.current stops repeat calls.
  const calling = useRef(new Set())
  useEffect(() => {
    for (const card of jobCards) {
      if (card.spare_parts != null || calling.current.has(card.id)) continue
      calling.current.add(card.id)
      logTable(`Job card for service ${card.service_no} is calling the spare parts module`, { service_no: card.service_no })
      callSparePartsModule(card.service_no).then((parts) => {
        calling.current.delete(card.id)
        const stored = loadDemoJobCards()
        if (!stored.some((c) => c.id === card.id)) return // cleared while calling
        const nextCards = stored.map((c) => (c.id === card.id ? { ...c, spare_parts: parts } : c))
        saveDemoJobCards(nextCards)
        logTable(`Spare parts for service ${card.service_no}`, parts.map((name) => ({ part: name })))
        logTable('job_card_table', nextCards)
        setJobCards(nextCards)
      })
    }
  }, [jobCards])

  function handleSubmit(e) {
    e.preventDefault()
    if (started) return
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }

    const next = [projectRow(1, Number(form.due), Number(form.lowerBuffer), Number(form.upperBuffer), form.basis)]

    // Every projected service gets a job card.
    const projected = next[next.length - 1]
    const nextCards = [...jobCards, jobCardFor(projected)]

    saveServiceProjection(next)
    saveDemoJobCards(nextCards)
    logTable('service_projection', next)
    logTable('demo_job_cards', nextCards)
    setRows(next)
    setJobCards(nextCards)
    setForm(emptyForm)

    setMessage(
      `Service ${projected.service_no} projected at ${km(projected.due)} km (${km(projected.lower_buffer_km)}–${km(
        projected.upper_buffer_km,
      )}). Job card created. Draft for 5 seconds, then ongoing.`,
    )
  }

  // Technician column: job cards from approval on (approved → in progress → completed / delayed completion / lapsed).
  const technicianStatuses = ['approved', 'in_progress', 'submitted', 'completed', 'lapsed', 'delayed_completion']
  const technicianCards = jobCards.filter((c) => technicianStatuses.includes(c.status))

  function setCardStatus(cardId, status, changes = {}) {
    const nextCards = jobCards.map((c) => (c.id === cardId ? { ...c, ...changes, status } : c))
    saveDemoJobCards(nextCards)
    logTable(`Job card ${statusLabels[status]}`, nextCards.find((c) => c.id === cardId))
    logTable('job_card_table', nextCards)
    setJobCards(nextCards)
  }

  // Technician submits the job card. One service is open at a time:
  // - odo before the next service's window → the old demo rule (on time → done; late → lapsed + delayed completion
  //   row), then the next service is projected and gets its job card.
  // - odo in or past the next service's window → late work: the odo only says where the work landed. The submitted
  //   service and those in between lapse; the landing service becomes the open row and its job card goes for
  //   approval with Done = this card's parts, To do = the parts of every later service up to the landing one.
  function handleTechnicianSubmit(card, values) {
    const odo = values.service_completed_at
    const open = rows[rows.length - 1]
    const canComplete =
      open && open.id === card.service_projection_id && (open.projection_status === 'draft' || open.projection_status === 'ongoing')

    let nextRows = rows
    let nextCards
    let note
    const landed = canComplete ? landLateWork(rows, odo) : null
    if (!canComplete) {
      nextCards = jobCards.map((c) => (c.id === card.id ? { ...c, ...values, status: 'completed' } : c))
      note = `Job card for service ${card.service_no} submitted.`
      logTable('Projection not completed: its service is not the open one', { service_projection_id: card.service_projection_id })
    } else if (landed) {
      nextRows = landed
      nextCards = lateWorkCards(jobCards, card, values, rows, landed, sparePartsFor)
      const landing = nextCards[nextCards.length - 1]
      note = `Service ${card.service_no} job card submitted at ${km(odo)} km — that falls on service ${landing.service_no}. Services ${
        card.service_no
      }–${landing.service_no - 1} lapsed. Service ${landing.service_no} job card needs approval with ${
        landing.pending_parts.length
      } parts to do.`
    } else {
      const closedRows = completeService(rows, odo, { projectNext: false })
      nextCards = jobCardsAfterCompletion(jobCards, card, values, rows, closedRows)
      nextRows = projectNextService(closedRows, odo)
      const projected = nextRows[nextRows.length - 1]
      nextCards = [...nextCards, jobCardFor(projected)]
      note = `Service ${card.service_no} completed at ${km(odo)} km. Service ${projected.service_no} projected at ${km(projected.due)} km (${km(
        projected.lower_buffer_km,
      )}–${km(projected.upper_buffer_km)}). Job card created. Draft for 5 seconds, then ongoing.`
    }

    // services table: a row for this job card and every job card this submit created already closed.
    const closedCards = nextCards.filter((c) => c.id === card.id || !jobCards.some((old) => old.id === c.id))
    const nextServices = [...services, ...serviceRowsFor(closedCards)]

    saveServiceProjection(nextRows)
    saveDemoJobCards(nextCards)
    saveDemoServices(nextServices)
    logTable('Job card Submitted', nextCards.find((c) => c.id === card.id))
    logTable('service_projection_table', nextRows)
    logTable('job_card_table', nextCards)
    logTable('services_table', nextServices)
    setRows(nextRows)
    setJobCards(nextCards)
    setServices(nextServices)
    setMessage(note)
  }

  function handleClear() {
    if (!window.confirm('Clear all service projections, job cards and services?')) return
    saveServiceProjection([])
    saveDemoJobCards([])
    saveDemoServices([])
    logTable('service_projection, demo_job_cards and demo_services cleared', [])
    setRows([])
    setJobCards([])
    setServices([])
    setForm(emptyForm)
    setErrors({})
    setMessage('')
  }

  // Once started, due point and buffers come from the open service.
  const shownValue = (name) => {
    if (!shown) return form[name]
    if (name === 'due') return String(shown.due)
    if (name === 'lowerBuffer') return String(shown.due - shown.lower_buffer_km)
    return String(shown.upper_buffer_km - shown.due)
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Demo</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the first due point and buffers, and choose how the next service is projected: from the previous
          service&apos;s odo + {km(INTERVAL_KM)} km, or from the previous projection + {km(INTERVAL_KM)} km (fixed). Services
          from the 2nd on get a {km(NEXT_BUFFER_KM)} km buffer either side. Services are completed from the job card.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
        <h2 className="text-base font-semibold">
          {active
            ? `Service ${active.service_no} is open`
            : started
                ? `Service ${last.service_no} done`
                : 'Start Projection'}
        </h2>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          {fields.map(({ name, label, placeholder }) => {
            const locked = started
            return (
              <div key={name}>
                <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                  {label} {!locked && <span className="text-neutral-400">*</span>}
                </label>
                <input
                  id={name}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={shownValue(name)}
                  disabled={locked}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, [name]: e.target.value }))
                    setErrors((prev) => ({ ...prev, [name]: undefined }))
                    setMessage('')
                  }}
                  placeholder={placeholder}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                  className={inputClass(errors[name])}
                />
                {errors[name] && (
                  <p id={`${name}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                    {errors[name]}
                  </p>
                )}
              </div>
            )
          })}
          <button type="submit" disabled={started} className={`${primaryButton} lg:mt-7`}>
            Submit
          </button>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-neutral-700">
            Project next service from {!started && <span className="text-neutral-400">*</span>}
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {PROJECTION_BASES.map(({ value, label, hint }) => {
              const checked = (shown ? shown.projection_basis ?? 'prev_odo' : form.basis) === value
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm has-[:disabled]:cursor-not-allowed ${
                    checked ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="basis"
                    value={value}
                    checked={checked}
                    disabled={started}
                    onChange={() => {
                      setForm((prev) => ({ ...prev, basis: value }))
                      setMessage('')
                    }}
                    className="mt-0.5 accent-neutral-900"
                  />
                  <span>
                    <span className="block font-medium text-neutral-900">{label}</span>
                    <span className="block text-xs text-neutral-500">{hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {isDraft && (
          <p className="mt-3 text-sm text-neutral-600">Service {active.service_no} is in draft — it turns ongoing in 5 seconds.</p>
        )}
        {active && !isDraft && !message && (
          <p className="mt-3 text-sm text-neutral-600">Service {active.service_no} is ongoing — it will be completed from the job card.</p>
        )}
        {message && !isDraft && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      </form>

      {rows.length === 0 && jobCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">service_projection_table is empty</h3>
          <p className="mt-1 text-sm text-neutral-500">Submit the form to project the first service.</p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem_16rem]">
          <div className="space-y-6">
            <div className={`overflow-hidden rounded-xl border bg-white ${tones.projection.box}`}>
              <div className={`flex items-center gap-2 border-b px-4 py-3 ${tones.projection.head}`}>
                <span className={`size-2.5 rounded-full ${tones.projection.dot}`} aria-hidden="true" />
                <h2 className="font-mono text-sm font-semibold">service_projection_table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className={`text-left text-xs font-semibold uppercase tracking-wide ${tones.projection.thead}`}>
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Service No</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Lower Buffer Days</th>
                      <th className="px-4 py-3">Upper Buffer Days</th>
                      <th className="px-4 py-3">Lower Buffer KM</th>
                      <th className="px-4 py-3">Upper Buffer KM</th>
                      <th className="px-4 py-3">Completed At</th>
                      <th className="px-4 py-3">Projection Status</th>
                      <th className="px-4 py-3">Work Done Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500" title={r.id}>{shortId(r.id)}</td>
                        <td className="px-4 py-3 tabular-nums text-neutral-500">{r.service_no}</td>
                        <td className="px-4 py-3 font-medium tabular-nums text-neutral-900">{km(r.due)}</td>
                        <td className="px-4 py-3 tabular-nums text-neutral-400">{km(r.lower_buffer_days)}</td>
                        <td className="px-4 py-3 tabular-nums text-neutral-400">{km(r.upper_buffer_days)}</td>
                        <td className="px-4 py-3 tabular-nums">{km(r.lower_buffer_km)}</td>
                        <td className="px-4 py-3 tabular-nums">{km(r.upper_buffer_km)}</td>
                        <td className="px-4 py-3 tabular-nums">{km(r.completed_at)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={statusLabels[r.projection_status]} />
                        </td>
                        <td className="px-4 py-3">
                          {r.work_done_status ? <StatusBadge status={statusLabels[r.work_done_status]} /> : <span className="text-neutral-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`overflow-hidden rounded-xl border bg-white ${tones.jobCard.box}`}>
              <div className={`flex items-center gap-2 border-b px-4 py-3 ${tones.jobCard.head}`}>
                <span className={`size-2.5 rounded-full ${tones.jobCard.dot}`} aria-hidden="true" />
                <h2 className="font-mono text-sm font-semibold">job_card_table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className={`text-left text-xs font-semibold uppercase tracking-wide ${tones.jobCard.thead}`}>
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Service Projection ID (FK)</th>
                      <th className="px-4 py-3">Service No</th>
                      <th className="px-4 py-3">Due At</th>
                      <th className="px-4 py-3">Lower Buffer KM</th>
                      <th className="px-4 py-3">Upper Buffer KM</th>
                      <th className="px-4 py-3">Completed At</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {jobCards.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                          No job cards yet.
                        </td>
                      </tr>
                    ) : (
                      jobCards.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500" title={c.id}>{shortId(c.id)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-900" title={c.service_projection_id}>
                            {shortId(c.service_projection_id)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-neutral-500">{c.service_no}</td>
                          <td className="px-4 py-3 font-medium tabular-nums text-neutral-900">{km(c.due)}</td>
                          <td className="px-4 py-3 tabular-nums">{km(c.lower_buffer_km)}</td>
                          <td className="px-4 py-3 tabular-nums">{km(c.upper_buffer_km)}</td>
                          <td className="px-4 py-3 tabular-nums">{km(c.service_completed_at)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={statusLabels[c.status ?? 'awaiting_approval']} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`overflow-hidden rounded-xl border bg-white ${tones.services.box}`}>
              <div className={`flex items-center gap-2 border-b px-4 py-3 ${tones.services.head}`}>
                <span className={`size-2.5 rounded-full ${tones.services.dot}`} aria-hidden="true" />
                <h2 className="font-mono text-sm font-semibold">services_table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className={`text-left text-xs font-semibold uppercase tracking-wide ${tones.services.thead}`}>
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Service No</th>
                      <th className="px-4 py-3">Job Card ID (FK)</th>
                      <th className="px-4 py-3">Parts</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {services.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                          No services yet — a row is added when a job card is completed, lapsed or delayed.
                        </td>
                      </tr>
                    ) : (
                      services.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500" title={r.id}>{shortId(r.id)}</td>
                          <td className="px-4 py-3 tabular-nums text-neutral-500">{r.service_no}</td>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-900" title={r.job_card_id}>
                            {shortId(r.job_card_id)}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{r.parts_count}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={statusLabels[r.status]} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <section aria-labelledby="job-cards-heading">
            <h2 id="job-cards-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-900">
              <span className={`size-2.5 rounded-full ${tones.jobCard.dot}`} aria-hidden="true" />
              Job Cards <span className="font-normal text-neutral-400">({jobCards.length})</span>
            </h2>
            <ServiceGroups
              cards={jobCards}
              tone={tones.jobCard}
              renderCard={(c) => (
                <JobCardTile
                  key={c.id}
                  card={c}
                  tone={tones.jobCard}
                  action={
                    (c.status ?? 'awaiting_approval') === 'awaiting_approval' &&
                    c.spare_parts != null && (
                      <button type="button" onClick={() => setCardStatus(c.id, 'approved')} className={cardButton}>
                        Approve
                      </button>
                    )
                  }
                />
              )}
            />
          </section>

          {/* Technician page (demo): job cards show up here once approved. */}
          <section aria-labelledby="technician-heading">
            <h2 id="technician-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-fuchsia-900">
              <span className={`size-2.5 rounded-full ${tones.technician.dot}`} aria-hidden="true" />
              Technician <span className="font-normal text-neutral-400">({technicianCards.length})</span>
            </h2>
            {technicianCards.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
                Approved job cards show up here.
              </p>
            ) : (
              <ServiceGroups
                cards={technicianCards}
                tone={tones.technician}
                renderCard={(c) => (
                  <JobCardTile
                    key={c.id}
                    card={c}
                    tone={tones.technician}
                    action={
                      c.status === 'approved' ? (
                        <button type="button" onClick={() => setCardStatus(c.id, 'in_progress')} className={cardButton}>
                          Start
                        </button>
                      ) : null
                    }
                  >
                    {c.status === 'in_progress' && (
                      <TechnicianCompletion card={c} onSubmit={(values) => handleTechnicianSubmit(c, values)} />
                    )}
                  </JobCardTile>
                )}
              />
            )}
          </section>
        </div>
      )}

      {(rows.length > 0 || jobCards.length > 0) && (
        <button
          type="button"
          onClick={handleClear}
          className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  )
}

export default Demo
