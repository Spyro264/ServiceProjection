import { useState } from 'react'
import { daysBetween, formatDate, today } from '../lib/dates.js'
import { findRule, projectFromAge, projectService, serviceLabel } from '../lib/projection.js'
import { recordEstimatedServices, recordPreviousServices, scheduleService } from '../lib/services.js'
import { loadMasterRules, loadVehicles, saveVehicles } from '../lib/storage.js'

const fields = [
  { name: 'regNo', label: 'Vehicle Reg No', placeholder: 'KA01AB1234' },
  { name: 'model', label: 'Vehicle Model', placeholder: 'Activa 6G' },
  { name: 'company', label: 'Vehicle Company', placeholder: 'Honda' },
  { name: 'invoiceDate', label: 'Invoice Date', type: 'date' },
]

// Older vehicles (invoice date more than this many days ago) can give their last service details.
// If they don't, past services are estimated from the vehicle's age.
const OLD_VEHICLE_DAYS = 40

const lastServiceFields = [
  { name: 'lastServiceNo', label: 'Last Service Number', type: 'number', placeholder: '6' },
  { name: 'lastServiceKm', label: 'Last Service KM', type: 'number', placeholder: '24000' },
  { name: 'lastServiceDate', label: 'Last Service Date', type: 'date' },
]

const emptyForm = { regNo: '', model: '', company: '', invoiceDate: '', lastServiceNo: '', lastServiceKm: '', lastServiceDate: '' }

const hasLastService = (form) => lastServiceFields.some(({ name }) => form[name].trim())

const isOldVehicle = (invoiceDate) =>
  Boolean(invoiceDate) && invoiceDate <= today() && daysBetween(invoiceDate, today()) > OLD_VEHICLE_DAYS

const inputClass = (error) =>
  `block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const normalizeRegNo = (regNo) => regNo.toUpperCase().replace(/\s+/g, '')

function validate(form, vehicles, rule) {
  const errors = {}
  for (const { name } of fields) {
    if (!form[name].trim()) errors[name] = 'Required'
  }
  if (!errors.regNo && vehicles.some((v) => v.regNo === normalizeRegNo(form.regNo))) {
    errors.regNo = 'Already onboarded'
  }
  if (!errors.model && !rule) {
    errors.model = 'No master rule for this model. Add a rule for this model, then onboard.'
  }
  if (!errors.invoiceDate && form.invoiceDate > today()) {
    errors.invoiceDate = 'Cannot be in the future'
  }
  // Last service details are optional, but if any one is filled, all three are needed.
  if (isOldVehicle(form.invoiceDate) && hasLastService(form)) {
    for (const { name } of lastServiceFields) {
      if (!form[name].trim()) errors[name] = 'Fill all three last service fields, or leave all empty'
    }
    if (!errors.lastServiceNo && !(Number.isInteger(Number(form.lastServiceNo)) && Number(form.lastServiceNo) >= 1)) {
      errors.lastServiceNo = 'Must be a whole number, 1 or more'
    }
    if (!errors.lastServiceKm && !(Number(form.lastServiceKm) > 0)) errors.lastServiceKm = 'Must be a number above 0'
    if (!errors.lastServiceDate && form.lastServiceDate > today()) errors.lastServiceDate = 'Cannot be in the future'
    if (!errors.lastServiceDate && form.lastServiceDate < form.invoiceDate) {
      errors.lastServiceDate = 'Cannot be before the invoice date'
    }
  }
  return errors
}

function OnboardVehicles() {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: name === 'regNo' ? value.toUpperCase() : value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setMessage('')
  }

  function handleSave(e) {
    e.preventDefault()
    const vehicles = loadVehicles()
    const rule = findRule(loadMasterRules(), form.model, form.invoiceDate)
    const nextErrors = validate(form, vehicles, rule)
    console.log('Onboard vehicle submitted', { form, errors: nextErrors })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const isOld = isOldVehicle(form.invoiceDate)
    const lastService =
      isOld && hasLastService(form)
        ? { serviceNo: Number(form.lastServiceNo), kmDoneAt: Number(form.lastServiceKm), doneDate: form.lastServiceDate }
        : null
    const estimate = isOld && !lastService ? projectFromAge(rule, form.invoiceDate, today()) : null
    const projection = lastService
      ? projectService(rule, form.invoiceDate, lastService.serviceNo + 1, lastService)
      : (estimate?.projection ?? projectService(rule, form.invoiceDate, 1))
    const vehicle = {
      id: crypto.randomUUID(),
      regNo: normalizeRegNo(form.regNo),
      model: rule.model,
      company: form.company.trim(),
      invoiceDate: form.invoiceDate,
      ruleId: rule.id,
      projection,
      onboardedAt: new Date().toISOString(),
    }
    saveVehicles([vehicle, ...vehicles])
    console.log('Onboard vehicle saved', vehicle)

    if (lastService) recordPreviousServices(vehicle, lastService)
    if (estimate) recordEstimatedServices(vehicle, estimate.pastCount)
    const jobCard = scheduleService(vehicle, projection)

    setForm(emptyForm)
    setMessage(
      `${vehicle.regNo} onboarded.${
        lastService
          ? ` Last service (${serviceLabel(lastService.serviceNo)}) recorded at ${lastService.kmDoneAt.toLocaleString('en-IN')} km on ${formatDate(lastService.doneDate)}.`
          : estimate
            ? estimate.pastCount > 0
              ? ` No service history entered, so ${estimate.pastCount} past ${estimate.pastCount === 1 ? 'service was' : 'services were'} estimated from the vehicle's age (${daysBetween(form.invoiceDate, today())} days) and saved as No Data.`
              : ` No service history entered, and no service is past yet for the vehicle's age (${daysBetween(form.invoiceDate, today())} days).`
            : ''
      } ${serviceLabel(projection.serviceNo)} projected and job card ${jobCard.jobCardNo} created.`,
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Onboard Vehicles</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Onboard new and existing vehicles to start projecting their services.
        </p>
      </div>

      <form onSubmit={handleSave} noValidate className="rounded-xl border border-neutral-200 bg-white">
        <div className="p-5 sm:px-6">
          <h2 className="text-base font-semibold">Vehicle Details</h2>
          <p className="mt-1 text-sm text-neutral-500">All vehicle fields are mandatory.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-y border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                {fields.map(({ name, label }) => (
                  <th key={name} className="px-2 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6">
                    <label htmlFor={name}>
                      {label} <span className="text-neutral-400">*</span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                {fields.map(({ name, placeholder, type = 'text' }) => (
                  <td key={name} className="min-w-44 px-2 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6">
                    <input
                      id={name}
                      name={name}
                      type={type}
                      value={form[name]}
                      onChange={handleChange}
                      placeholder={placeholder}
                      max={type === 'date' ? today() : undefined}
                      aria-invalid={Boolean(errors[name])}
                      aria-describedby={errors[name] ? `${name}-error` : undefined}
                      className={inputClass(errors[name])}
                    />
                    {errors[name] && (
                      <p id={`${name}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                        {errors[name]}
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {isOldVehicle(form.invoiceDate) && (
          <div className="border-t border-neutral-200 p-5 sm:px-6">
            <h3 className="text-base font-semibold">
              Last Service Details <span className="text-sm font-normal text-neutral-500">(optional)</span>
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              This vehicle's invoice date is {daysBetween(form.invoiceDate, today())} days old (more than {OLD_VEHICLE_DAYS}{' '}
              days). Optional: enter its last service and the next service is projected from it. If you leave these
              empty, the past services are estimated from the vehicle's age, saved as No Data, and the next service is
              projected.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {lastServiceFields.map(({ name, label, placeholder, type }) => (
                <div key={name}>
                  <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                    {label}
                  </label>
                  <input
                    id={name}
                    name={name}
                    type={type}
                    min={type === 'number' ? 1 : undefined}
                    inputMode={type === 'number' ? 'numeric' : undefined}
                    max={type === 'date' ? today() : undefined}
                    value={form[name]}
                    onChange={handleChange}
                    placeholder={placeholder}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={errors[name] ? `${name}-error` : undefined}
                    className={`mt-1.5 ${inputClass(errors[name])}`}
                  />
                  {errors[name] && (
                    <p id={`${name}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                      {errors[name]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 p-5 sm:px-6">
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Save
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </div>
      </form>
    </div>
  )
}

export default OnboardVehicles
