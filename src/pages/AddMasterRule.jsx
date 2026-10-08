import { useState } from 'react'
import BikePicker from '../components/BikePicker.jsx'
import RulePlanCard from '../components/RulePlanCard.jsx'
import { ordinal } from '../lib/projection.js'
import { assignBikesToTag, loadBikes, loadMasterRules, loadTags, saveMasterRules, saveTags } from '../lib/storage.js'

const MAX_FREE_SERVICES = 10

// Example values for the nth free service: 1000, 4000, 8000, 12000 ... km and 30, 90, 150, 210 ... days.
const kmExample = (n) => (n === 1 ? 1000 : 4000 * (n - 1))
const daysExample = (n) => (n === 1 ? 30 : 90 + 60 * (n - 2))

// Number of free services entered, or 0 while it is not a valid count.
function freeCountFrom(form) {
  const count = Number(form.freeServiceCount)
  return Number.isInteger(count) && count >= 1 && count <= MAX_FREE_SERVICES ? count : 0
}

const freeSlots = (count) => Array.from({ length: count }, (_, i) => i + 1)

// The KM and Day sections get one field per free service.
const sectionsFor = (count) => [
  {
    title: 'Free Services',
    fields: [{ name: 'freeServiceCount', label: 'No. of Free Services', placeholder: '3' }],
  },
  {
    title: 'KM Rules',
    fields: [
      ...freeSlots(count).map((n) => ({ name: `freeKm${n}`, label: `${ordinal(n)} Service (km)`, placeholder: String(kmExample(n)) })),
      { name: 'recursiveKm', label: 'Recursive KM', placeholder: '4000' },
      { name: 'kmLimit', label: 'KM Limit', placeholder: '500' },
    ],
  },
  {
    title: 'Day Rules',
    fields: [
      ...freeSlots(count).map((n) => ({ name: `freeDays${n}`, label: `${ordinal(n)} Days`, placeholder: String(daysExample(n)) })),
      { name: 'recursiveDays', label: 'Recursive Days', placeholder: '60' },
      { name: 'dayLimit', label: 'Day Limit', placeholder: '15' },
    ],
  },
]

const emptyForm = {
  freeServiceCount: '3',
  recursiveKm: '',
  kmLimit: '500',
  recursiveDays: '',
  dayLimit: '',
}

function validate(form) {
  const errors = {}
  for (const { name, type } of sectionsFor(freeCountFrom(form)).flatMap((s) => s.fields)) {
    const value = (form[name] ?? '').trim()
    if (!value) errors[name] = 'Required'
    else if (type !== 'text' && !(Number(value) > 0)) errors[name] = 'Must be a number above 0'
  }
  if (!errors.freeServiceCount && !freeCountFrom(form)) {
    errors.freeServiceCount = `Enter a whole number from 1 to ${MAX_FREE_SERVICES}`
  }
  return errors
}

// Rule values from a validated form.
function ruleFromForm(form) {
  const count = freeCountFrom(form)
  return {
    freeServiceCount: count,
    freeServices: freeSlots(count).map((n) => ({ km: Number(form[`freeKm${n}`]), days: Number(form[`freeDays${n}`]) })),
    recursiveKm: Number(form.recursiveKm),
    recursiveDays: Number(form.recursiveDays),
    kmLimit: Number(form.kmLimit),
    dayLimit: Number(form.dayLimit),
  }
}

const steps = [
  { label: 'Service Rule', caption: 'KM and day schedule' },
  { label: 'Tag', caption: 'Name this rule' },
  { label: 'Vehicles', caption: 'Pick the bikes' },
]

const loadFreeBikes = () => loadBikes().filter((bike) => !bike.tagId)

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'
const secondaryButton =
  'rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

function Stepper({ current }) {
  return (
    <ol className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {steps.map(({ label, caption }, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={`relative flex flex-col items-center gap-2 px-2 py-3 text-center sm:flex-row sm:gap-3 sm:px-5 sm:py-4 sm:text-left ${
              i > 0 ? 'border-l border-neutral-200' : ''
            }`}
          >
            <span
              className={`absolute inset-x-0 top-0 h-1 ${done ? 'bg-neutral-900' : active ? 'bg-brand' : 'bg-transparent'}`}
              aria-hidden="true"
            />
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done ? 'bg-neutral-900 text-white' : active ? 'bg-brand text-neutral-950' : 'border border-neutral-300 text-neutral-500'
              }`}
            >
              {done ? (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="w-full min-w-0 sm:w-auto">
              <span className={`block truncate text-xs font-semibold sm:text-sm ${active || done ? 'text-neutral-900' : 'text-neutral-500'}`}>
                {label}
              </span>
              <span className="hidden truncate text-xs text-neutral-500 sm:block">{caption}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function AddMasterRule() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [tagName, setTagName] = useState('')
  const [tagError, setTagError] = useState('')
  const [freeBikes, setFreeBikes] = useState(loadFreeBikes)
  const [selectedBikes, setSelectedBikes] = useState([])
  const [message, setMessage] = useState('')

  const sections = sectionsFor(freeCountFrom(form))

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setMessage('')
  }

  function handleRuleNext(e) {
    e.preventDefault()
    const nextErrors = validate(form)
    console.log('Service rule step submitted', { form, errors: nextErrors })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setStep(1)
  }

  function handleTagNext(e) {
    e.preventDefault()
    const name = tagName.trim()
    let error = ''
    if (!name) error = 'Required'
    else if (loadTags().some((tag) => tag.name.toLowerCase() === name.toLowerCase())) error = 'This tag name is already used'
    setTagError(error)
    if (error) return
    setStep(2)
  }

  function handleSave() {
    const now = new Date().toISOString()
    const rule = { id: crypto.randomUUID(), ...ruleFromForm(form), createdAt: now }
    const tag = { id: crypto.randomUUID(), name: tagName.trim(), ruleId: rule.id, createdAt: now }

    const masterTable = [rule, ...loadMasterRules()]
    saveMasterRules(masterTable)
    const tags = [tag, ...loadTags()]
    saveTags(tags)
    const bikes = assignBikesToTag(selectedBikes, tag.id)
    console.log('Service rule saved', { rule, tag, bikeIds: selectedBikes })
    console.log('mastertable', masterTable)
    console.log('tags', tags)
    console.log('bikes', bikes)

    setForm(emptyForm)
    setTagName('')
    setSelectedBikes([])
    setFreeBikes(loadFreeBikes())
    setStep(0)
    setMessage(
      `Service rule saved with tag "${tag.name}" and ${selectedBikes.length} bike${
        selectedBikes.length === 1 ? '' : 's'
      }.`,
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Service Plan Setup</h1>
      </div>

      <Stepper current={step} />

      {step === 0 && (
        <form onSubmit={handleRuleNext} noValidate className="rounded-xl border border-neutral-200 bg-white">
          {sections.map(({ title, fields: sectionFields }) => (
            <div key={title} className="border-b border-neutral-200 p-5 sm:px-6">
              <h2 className="text-base font-semibold">{title}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {sectionFields.map(({ name, label, placeholder, type = 'number' }) => (
                  <div key={name}>
                    <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                      {label} <span className="text-neutral-400">*</span>
                    </label>
                    <input
                      id={name}
                      name={name}
                      type={type}
                      inputMode={type === 'number' ? 'numeric' : undefined}
                      min={type === 'number' ? 1 : undefined}
                      value={form[name] ?? ''}
                      onChange={handleChange}
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
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 p-5 sm:px-6">
            <button type="submit" className={primaryButton}>
              Next
            </button>
            {message && <p className="text-sm text-neutral-600">{message}</p>}
          </div>
        </form>
      )}

      {step > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <aside className="lg:sticky lg:top-8 lg:order-last">
            <RulePlanCard
              rule={ruleFromForm(form)}
              tagName={step === 2 ? tagName.trim() : undefined}
              bikeCount={step === 2 ? selectedBikes.length : undefined}
            />
          </aside>

          {step === 1 && (
            <form onSubmit={handleTagNext} noValidate className="rounded-xl border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 p-5 sm:px-6">
                <h2 className="text-base font-semibold">Tag</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Give this rule a tag name. The rule is shown alongside for reference.
                </p>
                <div className="mt-4 max-w-sm">
                  <label htmlFor="tagName" className="block text-sm font-medium text-neutral-700">
                    Tag Name <span className="text-neutral-400">*</span>
                  </label>
                  <input
                    id="tagName"
                    type="text"
                    value={tagName}
                    onChange={(e) => {
                      setTagName(e.target.value)
                      setTagError('')
                    }}
                    placeholder="Bangalore Fleet"
                    autoFocus
                    aria-invalid={Boolean(tagError)}
                    aria-describedby={tagError ? 'tagName-error' : undefined}
                    className={inputClass(tagError)}
                  />
                  {tagError && (
                    <p id="tagName-error" className="mt-1 text-xs font-medium text-neutral-900">
                      {tagError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 p-5 sm:px-6">
                <button type="button" onClick={() => setStep(0)} className={secondaryButton}>
                  Back
                </button>
                <button type="submit" className={primaryButton}>
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Vehicles</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Pick the bikes for tag &ldquo;{tagName.trim()}&rdquo;. Only bikes without a tag are shown.
                </p>
              </div>

              <BikePicker bikes={freeBikes} selected={selectedBikes} onChange={setSelectedBikes} />

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setStep(1)} className={secondaryButton}>
                  Back
                </button>
                <button type="button" onClick={handleSave} className={primaryButton}>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AddMasterRule
