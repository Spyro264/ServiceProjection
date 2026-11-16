import { useEffect, useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'
import { logTable } from '../lib/log.js'
import { loadServiceProjection, saveServiceProjection } from '../lib/storage.js'

// Demo only: every service is INTERVAL_KM after the previous one, services from the 2nd on get a
// NEXT_BUFFER_KM window either side, and a projected row stays draft for DRAFT_MS.
const INTERVAL_KM = 2500
const NEXT_BUFFER_KM = 500
const DRAFT_MS = 5000

const statusLabels = {
  draft: 'Draft',
  ongoing: 'Ongoing',
  lapsed: 'Lapsed',
  completed: 'Completed',
  done: 'Done',
  delayed_completion: 'Delayed Completion',
}

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
  { name: 'completedAt', label: 'Service Completed At (km)', placeholder: '800' },
]

const emptyForm = { due: '', lowerBuffer: '', upperBuffer: '', completedAt: '' }

const km = (value) => (value == null ? '—' : value.toLocaleString('en-IN'))

function projectRow(serviceNo, due, lowerBuffer, upperBuffer) {
  return {
    id: crypto.randomUUID(),
    service_no: serviceNo,
    due,
    lower_buffer_days: null,
    upper_buffer_days: null,
    lower_buffer_km: due - lowerBuffer,
    upper_buffer_km: due + upperBuffer,
    completed_at: null,
    projection_status: 'draft',
    work_done_status: null,
    created_at: new Date().toISOString(),
  }
}

// Closes the ongoing service at odo `done`, then projects the next one from `done` + interval.
// - inside the window                         → completed / done
// - past the window, before the next window   → this row lapsed / lapsed, plus a new row for the same service
//                                                marked completed / delayed completion at `done`
// - inside (or past) the next service's window → lapsed / lapsed, and the next service is checked the same way
function completeService(rows, done) {
  const next = [...rows]
  let current = { ...next[next.length - 1] }
  next[next.length - 1] = current

  for (;;) {
    if (done <= current.upper_buffer_km) {
      Object.assign(current, { completed_at: done, projection_status: 'completed', work_done_status: 'done' })
      break
    }
    const following = projectRow(current.service_no + 1, current.due + INTERVAL_KM, NEXT_BUFFER_KM, NEXT_BUFFER_KM)
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

  next.push(projectRow(current.service_no + 1, done + INTERVAL_KM, NEXT_BUFFER_KM, NEXT_BUFFER_KM))
  return next
}

function validate(form, active) {
  const errors = {}
  const num = (name) => Number(form[name])
  const isWhole = (name) => form[name].trim() !== '' && Number.isInteger(num(name)) && num(name) >= 0

  if (!active) {
    for (const name of ['due', 'lowerBuffer', 'upperBuffer']) {
      if (form[name].trim() === '') errors[name] = 'Required'
      else if (!isWhole(name)) errors[name] = 'Enter a whole number of km'
    }
    if (!errors.due && num('due') <= 0) errors.due = 'Must be more than 0'
    if (!errors.due && !errors.lowerBuffer && num('lowerBuffer') > num('due')) errors.lowerBuffer = 'Cannot be more than the due point'
  }

  if (form.completedAt.trim() === '') {
    if (active) errors.completedAt = 'Required'
  } else if (!isWhole('completedAt')) {
    errors.completedAt = 'Enter a whole number of km'
  } else {
    const windowStart = active ? active.lower_buffer_km : num('due') - num('lowerBuffer')
    if (!Number.isNaN(windowStart) && num('completedAt') < windowStart) {
      errors.completedAt = `Before the window start (${km(windowStart)} km)`
    }
  }
  return errors
}

function Demo() {
  const [rows, setRows] = useState(loadServiceProjection)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  // The open service is the last row while it is draft or ongoing.
  const last = rows[rows.length - 1]
  const active = last && (last.projection_status === 'draft' || last.projection_status === 'ongoing') ? last : null
  const isDraft = active?.projection_status === 'draft'

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

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate(form, active)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }

    let next = rows
    if (!active) {
      next = [projectRow(1, Number(form.due), Number(form.lowerBuffer), Number(form.upperBuffer))]
    }
    if (form.completedAt.trim() !== '') {
      next = completeService(next, Number(form.completedAt))
    }

    saveServiceProjection(next)
    logTable('service_projection', next)
    setRows(next)
    setForm(emptyForm)

    const projected = next[next.length - 1]
    setMessage(
      `Service ${projected.service_no} projected at ${km(projected.due)} km (${km(projected.lower_buffer_km)}–${km(
        projected.upper_buffer_km,
      )}). Draft for 5 seconds, then ongoing.`,
    )
  }

  function handleClear() {
    if (!window.confirm('Clear all service_projection rows?')) return
    saveServiceProjection([])
    logTable('service_projection cleared', [])
    setRows([])
    setForm(emptyForm)
    setErrors({})
    setMessage('')
  }

  // Once started, due point and buffers come from the open service.
  const shownValue = (name) => {
    if (!active || name === 'completedAt') return form[name]
    if (name === 'due') return String(active.due)
    if (name === 'lowerBuffer') return String(active.due - active.lower_buffer_km)
    return String(active.upper_buffer_km - active.due)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Demo</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the first due point and buffers, then the odometer the service was completed at. Each next service is
          projected at completed odo + {km(INTERVAL_KM)} km with a {km(NEXT_BUFFER_KM)} km buffer either side.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
        <h2 className="text-base font-semibold">
          {active ? `Complete Service ${active.service_no}` : 'Start Projection'}
        </h2>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          {fields.map(({ name, label, placeholder }) => {
            const locked = Boolean(active) && name !== 'completedAt'
            const required = name !== 'completedAt' || Boolean(active)
            return (
              <div key={name}>
                <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                  {label} {required && !locked && <span className="text-neutral-400">*</span>}
                </label>
                <input
                  id={name}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={shownValue(name)}
                  disabled={locked || (name === 'completedAt' && isDraft)}
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
          <button type="submit" disabled={isDraft} className={`${primaryButton} lg:mt-7`}>
            Submit
          </button>
        </div>
        {isDraft && (
          <p className="mt-3 text-sm text-neutral-600">Service {active.service_no} is in draft — it turns ongoing in 5 seconds.</p>
        )}
        {message && !isDraft && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">service_projection is empty</h3>
          <p className="mt-1 text-sm text-neutral-500">Submit the form to project the first service.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="font-mono text-sm font-semibold">service_projection</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
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
      )}

      {rows.length > 0 && (
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
