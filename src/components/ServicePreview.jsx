import { useState } from 'react'
import { formatDate, today } from '../lib/dates.js'
import { formatDateRange, formatKmRange, lapseReason, placeLateWork, projectService, serviceLabel } from '../lib/projection.js'
import { closeOutcome } from '../lib/services.js'

// Same colours as the service history page.
const statusClass = {
  Completed: 'bg-green-600 text-white',
  Lapsed: 'bg-red-600 text-white',
  Pending: 'bg-brand text-neutral-950',
}

const inputClass = (error) =>
  `mt-1 block w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const km = (value) => `${value.toLocaleString('en-IN')} km`

// Replays the job card flow for the rule being set up: each entry in `dones` closes the pending service.
// Lapsed: the slot stays lapsed, every later slot the work has also passed lapses too, the work takes the first slot
// it has not passed (Completed), and the one after is projected.
function timeline(rule, invoiceDate, dones) {
  const rows = []
  let pending = projectService(rule, invoiceDate, 1)
  for (const done of dones) {
    if (!pending) break
    const outcome = closeOutcome(pending, done)
    rows.push({ ...pending, ...outcome })
    if (outcome.status === 'Lapsed') {
      const { skipped, late } = placeLateWork(rule, invoiceDate, pending, done)
      rows.push(...skipped.map((p) => ({ ...p, ...done, lapsedWith: pending.serviceNo, status: 'Lapsed' })))
      if (!late) {
        pending = null
        break
      }
      rows.push({ serviceNo: late.serviceNo, serviceType: late.serviceType, lateFor: pending.serviceNo, ...done, status: 'Completed' })
      pending = projectService(rule, invoiceDate, late.serviceNo + 1, { ...late, ...done })
    } else {
      pending = projectService(rule, invoiceDate, pending.serviceNo + 1, { ...pending, ...outcome })
    }
  }
  return { rows, pending }
}

function DoneForm({ pending, onSubmit }) {
  const [kmDoneAt, setKmDoneAt] = useState('')
  const [doneDate, setDoneDate] = useState('')
  const [errors, setErrors] = useState({})

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
    <form onSubmit={handleSubmit} noValidate className="mt-3 border-t border-neutral-200 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="preview-km" className="block text-xs font-medium text-neutral-700">
            KM Done At
          </label>
          <input
            id="preview-km"
            type="number"
            inputMode="numeric"
            min={1}
            value={kmDoneAt}
            onChange={(e) => {
              setKmDoneAt(e.target.value)
              setErrors((prev) => ({ ...prev, kmDoneAt: undefined }))
            }}
            placeholder={pending.kmIdeal != null ? String(pending.kmIdeal) : String(pending.kmTo)}
            aria-invalid={Boolean(errors.kmDoneAt)}
            className={inputClass(errors.kmDoneAt)}
          />
          {errors.kmDoneAt && <p className="mt-1 text-xs font-medium text-neutral-900">{errors.kmDoneAt}</p>}
        </div>
        <div>
          <label htmlFor="preview-date" className="block text-xs font-medium text-neutral-700">
            Done Date
          </label>
          <input
            id="preview-date"
            type="date"
            value={doneDate}
            onChange={(e) => {
              setDoneDate(e.target.value)
              setErrors((prev) => ({ ...prev, doneDate: undefined }))
            }}
            aria-invalid={Boolean(errors.doneDate)}
            className={inputClass(errors.doneDate)}
          />
          {errors.doneDate && <p className="mt-1 text-xs font-medium text-neutral-900">{errors.doneDate}</p>}
        </div>
      </div>
      <button
        type="submit"
        className="mt-2 w-full rounded-lg bg-neutral-950 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        Submit
      </button>
    </form>
  )
}

function Row({ row }) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">
          {serviceLabel(row.serviceNo)} <span className="ml-1 text-xs font-normal text-neutral-500">{row.serviceType}</span>
        </p>
        <span className={`rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${statusClass[row.status]}`}>
          {row.status}
        </span>
      </div>
      {row.lateFor ? (
        <p className="mt-1 text-xs text-neutral-600">
          Late work for the lapsed {serviceLabel(row.lateFor)}: {km(row.kmDoneAt)} on {formatDate(row.doneDate)}. It takes this slot.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs tabular-nums text-neutral-700">
            Due {formatKmRange(row)} · {formatDateRange(row)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">{row.basis}</p>
          {row.status === 'Completed' && (
            <p className="mt-1 text-xs font-medium text-green-700">
              Done at {km(row.kmDoneAt)} on {formatDate(row.doneDate)}.
            </p>
          )}
          {row.status === 'Lapsed' && (
            <p className="mt-1 text-xs font-medium text-red-700">
              {row.lapsedWith ? `Not done. The late work for the ${serviceLabel(row.lapsedWith)}` : 'Done'} at {km(row.kmDoneAt)} on{' '}
              {formatDate(row.doneDate)}: {lapseReason(row)}.
            </p>
          )}
        </>
      )}
    </li>
  )
}

// Playground for the rule being set up: projects the services and lets you close each one with a km and date,
// the same way a job card is closed. Nothing is saved.
function ServicePreview({ rule, ready }) {
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dones, setDones] = useState([])
  const { rows, pending } = ready && invoiceDate ? timeline(rule, invoiceDate, dones) : { rows: [], pending: null }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold">Preview</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Try the rule: enter when each service is done to see if it is Completed or Lapsed and what is projected next. Nothing is saved.
        </p>
        <label htmlFor="preview-invoice" className="mt-3 block text-xs font-medium text-neutral-700">
          Invoice Date
        </label>
        <input
          id="preview-invoice"
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
          className={inputClass(!invoiceDate)}
        />
      </div>

      <div className="p-4">
        {!ready ? (
          <p className="text-sm text-neutral-500">Fill in every service&apos;s days, km and buffers (and the recursive fields) to see the preview.</p>
        ) : !invoiceDate ? (
          <p className="text-sm text-neutral-500">Pick an invoice date to see the preview.</p>
        ) : (
          <>
            <ol className="space-y-2">
              {rows.map((row) => (
                <Row key={row.serviceNo} row={row} />
              ))}
              {pending ? (
                <li className="rounded-lg border-2 border-brand bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900">
                      {serviceLabel(pending.serviceNo)} <span className="ml-1 text-xs font-normal text-neutral-500">{pending.serviceType}</span>
                    </p>
                    <span className={`rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${statusClass.Pending}`}>
                      Pending
                    </span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-neutral-700">
                    Due {formatKmRange(pending)} · {formatDateRange(pending)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{pending.basis}</p>
                  <DoneForm key={pending.serviceNo} pending={pending} onSubmit={(done) => setDones((prev) => [...prev, done])} />
                </li>
              ) : (
                <li className="rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-500">
                  Rule finished: no more services are projected.
                </li>
              )}
            </ol>
            {dones.length > 0 && (
              <div className="mt-3 flex gap-3 text-sm">
                <button type="button" onClick={() => setDones((prev) => prev.slice(0, -1))} className="font-medium text-neutral-900 underline">
                  Undo last
                </button>
                <button type="button" onClick={() => setDones([])} className="font-medium text-neutral-900 underline">
                  Reset
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ServicePreview
