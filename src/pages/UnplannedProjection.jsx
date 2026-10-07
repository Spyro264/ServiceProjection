import { useState } from 'react'
import { SERVICE_CENTERS } from '../lib/services.js'
import { loadVehicles } from '../lib/storage.js'
import { CRITICAL_SERVICES, criticalName, describeDecision, raiseUnplanned } from '../lib/unplanned.js'

const emptyForm = { regNo: '', items: [], serviceDays: '', serviceCenter: '' }

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const normalizeRegNo = (regNo) => regNo.toUpperCase().replace(/\s+/g, '')

function FieldError({ id, error }) {
  return error ? (
    <p id={id} className="mt-1 text-xs font-medium text-neutral-900">
      {error}
    </p>
  ) : null
}

// Type anything, or pick from the critical list. Enter adds the typed text.
function ServiceItemsInput({ items, onChange, error }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  const options = CRITICAL_SERVICES.filter(
    (name) => !items.includes(name) && name.toLowerCase().includes(text.trim().toLowerCase()),
  )

  function add(value) {
    const item = criticalName(value) ?? value.trim()
    if (item && !items.some((i) => i.toLowerCase() === item.toLowerCase())) onChange([...items, item])
    setText('')
  }

  return (
    <div>
      <label htmlFor="serviceItems" className="block text-sm font-medium text-neutral-700">
        Things to Do in This Service <span className="text-neutral-400">*</span>
      </label>
      <p className="mt-0.5 text-xs text-neutral-500">
        Pick from the list (critical) or type your own and press Enter (non-critical).
      </p>

      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white py-1 pl-3 pr-1 text-sm text-neutral-900"
            >
              {item}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  criticalName(item) ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {criticalName(item) ? 'Critical' : 'Non-critical'}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label={`Remove ${item}`}
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          id="serviceItems"
          type="text"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls="serviceItems-options"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search or type a service"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'serviceItems-error' : undefined}
          className={inputClass(error)}
        />
        {open && options.length > 0 && (
          <ul
            id="serviceItems-options"
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {options.map((name) => (
              <li
                key={name}
                role="option"
                aria-selected={false}
                // mousedown so the pick happens before the input blurs and closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(name)
                }}
                className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
              >
                {name}
                <span className="text-xs font-medium text-red-600">Critical</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FieldError id="serviceItems-error" error={error} />
    </div>
  )
}

function validate(form, vehicle) {
  const errors = {}
  if (!form.regNo.trim()) errors.regNo = 'Required'
  else if (!vehicle) errors.regNo = 'Vehicle not onboarded'
  if (form.items.length === 0) errors.items = 'Add at least one item'
  if (!form.serviceDays.trim()) errors.serviceDays = 'Required'
  else if (!(Number(form.serviceDays) > 0)) errors.serviceDays = 'Must be a number above 0'
  if (!form.serviceCenter) errors.serviceCenter = 'Required'
  return errors
}

function UnplannedProjection() {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setMessage('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const vehicle = loadVehicles().find((v) => v.regNo === normalizeRegNo(form.regNo))
    const nextErrors = validate(form, vehicle)
    console.log('Unplanned request submitted', { form, errors: nextErrors })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const result = raiseUnplanned(vehicle, {
      items: form.items,
      serviceDays: Number(form.serviceDays),
      serviceCenter: form.serviceCenter,
    })
    setForm(emptyForm)
    setMessage(describeDecision(result))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Unplanned Projection</h1>
        <p className="mt-1 text-sm text-neutral-500">Raise a request for an unplanned service.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-neutral-200 bg-white">
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label htmlFor="regNo" className="block text-sm font-medium text-neutral-700">
              Vehicle Reg No <span className="text-neutral-400">*</span>
            </label>
            <input
              id="regNo"
              type="text"
              value={form.regNo}
              onChange={(e) => set('regNo', e.target.value.toUpperCase())}
              placeholder="KA01AB1234"
              aria-invalid={Boolean(errors.regNo)}
              aria-describedby={errors.regNo ? 'regNo-error' : undefined}
              className={inputClass(errors.regNo)}
            />
            <FieldError id="regNo-error" error={errors.regNo} />
          </div>

          <ServiceItemsInput items={form.items} onChange={(items) => set('items', items)} error={errors.items} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="serviceDays" className="block text-sm font-medium text-neutral-700">
                Days Required for Service <span className="text-neutral-400">*</span>
              </label>
              <input
                id="serviceDays"
                type="number"
                min={1}
                inputMode="numeric"
                value={form.serviceDays}
                onChange={(e) => set('serviceDays', e.target.value)}
                placeholder="1"
                aria-invalid={Boolean(errors.serviceDays)}
                aria-describedby={errors.serviceDays ? 'serviceDays-error' : undefined}
                className={inputClass(errors.serviceDays)}
              />
              <FieldError id="serviceDays-error" error={errors.serviceDays} />
            </div>
            <div>
              <label htmlFor="serviceCenter" className="block text-sm font-medium text-neutral-700">
                Service Center <span className="text-neutral-400">*</span>
              </label>
              <select
                id="serviceCenter"
                value={form.serviceCenter}
                onChange={(e) => set('serviceCenter', e.target.value)}
                aria-invalid={Boolean(errors.serviceCenter)}
                aria-describedby={errors.serviceCenter ? 'serviceCenter-error' : undefined}
                className={inputClass(errors.serviceCenter)}
              >
                <option value="">Select</option>
                {SERVICE_CENTERS.map((center) => (
                  <option key={center} value={center}>
                    {center}
                  </option>
                ))}
              </select>
              <FieldError id="serviceCenter-error" error={errors.serviceCenter} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 p-5 sm:px-6">
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Raise Request
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </div>
      </form>
    </div>
  )
}

export default UnplannedProjection
