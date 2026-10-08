import { useState } from 'react'
import { daysBetween, formatDate, today } from '../lib/dates.js'
import { projectFromAge, projectService, ruleSummary, serviceLabel } from '../lib/projection.js'
import { recordEstimatedServices, recordPreviousServices, scheduleService, tagRuleFor } from '../lib/services.js'
import { loadBikes, loadMasterRules, loadTags, loadVehicles, saveVehicles } from '../lib/storage.js'

// Vehicle details below the bike picker. Model is filled from the selected bike.
const detailFields = [
  { name: 'model', label: 'Vehicle Model', readOnly: true, placeholder: 'Filled from the bike' },
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

// Reg No choices: bikes that have a tag and are not onboarded yet, with their tag and its rule.
function taggedBikeOptions() {
  const tags = loadTags()
  const rules = loadMasterRules()
  const onboarded = new Set(loadVehicles().map((v) => v.regNo))
  return loadBikes()
    .filter((bike) => bike.tagId && !onboarded.has(bike.regNo))
    .map((bike) => {
      const tag = tags.find((t) => t.id === bike.tagId)
      return { ...bike, tagName: tag?.name ?? '—', rule: tag && rules.find((r) => r.id === tag.ruleId) }
    })
}

function validate(form, vehicles, { tag, rule }) {
  const errors = {}
  if (!form.regNo) errors.regNo = 'Select a bike'
  for (const { name, readOnly } of detailFields) {
    if (!readOnly && !form[name].trim()) errors[name] = 'Required'
  }
  if (!errors.regNo && vehicles.some((v) => v.regNo === normalizeRegNo(form.regNo))) {
    errors.regNo = 'Already onboarded'
  }
  // The service rule comes from the bike's tag, so the bike must be tagged first.
  if (!errors.regNo && !tag) {
    errors.regNo = 'No tag assigned to this bike. Assign a tag in Service Plan Setup, then onboard.'
  } else if (!errors.regNo && !rule) {
    errors.regNo = "This bike's tag has no service rule."
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
  const bikeOptions = taggedBikeOptions()
  const selectedBike = bikeOptions.find((b) => b.regNo === form.regNo)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'regNo' && { model: bikeOptions.find((b) => b.regNo === value)?.model ?? '' }),
    }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setMessage('')
  }

  function handleSave(e) {
    e.preventDefault()
    const vehicles = loadVehicles()
    const tagRule = tagRuleFor(normalizeRegNo(form.regNo))
    const { tag, rule } = tagRule
    const nextErrors = validate(form, vehicles, tagRule)
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
      model: form.model.trim(),
      company: form.company.trim(),
      invoiceDate: form.invoiceDate,
      tagId: tag.id,
      ruleId: rule.id,
      projection,
      onboardedAt: new Date().toISOString(),
    }
    saveVehicles([vehicle, ...vehicles])
    console.log('Onboard vehicle saved', vehicle)

    if (lastService) recordPreviousServices(vehicle, rule, lastService)
    if (estimate) recordEstimatedServices(vehicle, rule, estimate.pastCount)
    const jobCard = scheduleService(vehicle, projection)

    setForm(emptyForm)
    setMessage(
      `${vehicle.regNo} onboarded on tag "${tag.name}".${
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

      {message && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand bg-brand/15 p-4 text-sm text-neutral-900" role="status">
          <svg className="mt-0.5 size-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p>{message}</p>
        </div>
      )}

      <form onSubmit={handleSave} noValidate className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 p-5 sm:px-6">
          <h2 className="text-base font-semibold">Pick Bike</h2>
          <p className="mt-1 text-sm text-neutral-500">Only bikes with a tag are listed. The bike follows its tag&apos;s service rule.</p>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="regNo" className="block text-sm font-medium text-neutral-700">
                Vehicle Reg No <span className="text-neutral-400">*</span>
              </label>
              <select
                id="regNo"
                name="regNo"
                value={form.regNo}
                onChange={handleChange}
                aria-invalid={Boolean(errors.regNo)}
                aria-describedby={errors.regNo ? 'regNo-error' : undefined}
                className={`mt-1.5 ${inputClass(errors.regNo)}`}
              >
                <option value="">{bikeOptions.length ? 'Select a bike' : 'No tagged bikes'}</option>
                {bikeOptions.map(({ regNo, tagName }) => (
                  <option key={regNo} value={regNo}>
                    {regNo} · {tagName}
                  </option>
                ))}
              </select>
              {errors.regNo ? (
                <p id="regNo-error" className="mt-1 text-xs font-medium text-neutral-900">
                  {errors.regNo}
                </p>
              ) : (
                bikeOptions.length === 0 && (
                  <p className="mt-1 text-xs text-neutral-500">Assign a tag in Service Plan Setup first.</p>
                )
              )}
            </div>

            {selectedBike ? (
              <div className="rounded-lg bg-neutral-950 p-4 text-neutral-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-sm font-semibold text-brand">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                    </svg>
                    {selectedBike.tagName}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {selectedBike.model} · {selectedBike.year}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">
                  {selectedBike.rule ? ruleSummary(selectedBike.rule) : 'This tag has no service rule.'}
                </p>
              </div>
            ) : (
              <div className="hidden h-full items-center rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 lg:flex">
                Pick a bike to see its tag and service rule.
              </div>
            )}
          </div>
        </div>

        <div className="p-5 sm:px-6">
          <h2 className="text-base font-semibold">Vehicle Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {detailFields.map(({ name, label, placeholder, readOnly, type = 'text' }) => (
              <div key={name}>
                <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                  {label} {readOnly ? <span className="text-xs font-normal text-neutral-400">(auto)</span> : <span className="text-neutral-400">*</span>}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  value={form[name]}
                  onChange={handleChange}
                  readOnly={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  placeholder={placeholder}
                  max={type === 'date' ? today() : undefined}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                  className={`mt-1.5 ${readOnly ? 'block w-full cursor-default rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none' : inputClass(errors[name])}`}
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
            Onboard
          </button>
        </div>
      </form>
    </div>
  )
}

export default OnboardVehicles
