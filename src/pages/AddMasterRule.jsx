import { useState } from 'react'
import { Link } from 'react-router'
import RulePlanCard from '../components/RulePlanCard.jsx'
import { slotLabels, windowOf } from '../lib/projection.js'
import { addMasterRule, loadBikes, loadMasterRules, loadServiceRuleItems, loadServiceRules, loadTags, saveTags } from '../lib/storage.js'
import { logTable } from '../lib/log.js'

// Example values: the 1st service within 30 days / 1,000 km of the invoice date with a ±5 day and ±200 km buffer,
// later ones 60 days / 4,000 km after the previous service with a ±15 day and ±500 km buffer.
const invoiceExample = { days: 30, km: 1000, daysLower: 5, daysUpper: 5, kmLower: 200, kmUpper: 200 }
const previousExample = { days: 60, km: 4000, daysLower: 15, daysUpper: 15, kmLower: 500, kmUpper: 500 }

const idealFields = [
  { name: 'days', label: 'Service Active After (Days)' },
  { name: 'km', label: 'Service Due After (km)' },
]

// The 1st service is always within 30 days of the invoice date.
const FIRST_SERVICE_DAYS = '30'
const daysLabel = (i) => (i === 0 ? 'Service Within (Days)' : 'Service Active After (Days)')

// Lower limit is taken off the ideal value, upper limit is added to it.
const bufferGroups = [
  {
    title: 'Buffer Duration',
    fields: [
      { name: 'daysLower', label: 'Lower Limit (Days)' },
      { name: 'daysUpper', label: 'Upper Limit (Days)' },
    ],
  },
  {
    title: 'Buffer Odometer Reading',
    fields: [
      { name: 'kmLower', label: 'Lower Limit (km)' },
      { name: 'kmUpper', label: 'Upper Limit (km)' },
    ],
  },
]

const bufferFields = bufferGroups.flatMap((group) => group.fields)

const numberFields = [...idealFields, ...bufferFields]

// What a recursive service is counted from. A non-recursive service is counted from the previous service's actual odo / date.
const baseOptions = [
  { value: 'actual', label: 'Previous service (actual odo / date)' },
  { value: 'projected', label: 'Previous projected service' },
]

// One service in the form. Values are strings while editing. The 1st service is always Free, from the invoice date;
// every later one is counted from the previous service.
const newEntry = (type, base) => ({
  key: crypto.randomUUID(),
  type,
  days: '',
  km: '',
  daysLower: '',
  daysUpper: '',
  kmLower: '',
  kmUpper: '',
  base,
  recursive: 'no',
  count: '',
  kmInterval: '',
})

const emptySchedule = () => [{ ...newEntry('Free', 'invoice'), days: FIRST_SERVICE_DAYS }]

const errorKey = (entry, field) => `${entry.key}.${field}`

const isNumberAtLeast = (value, min) => value.trim() !== '' && Number(value) >= min

function validate(ruleName, schedule) {
  const errors = {}
  const name = ruleName.trim()
  if (!name) errors.ruleName = 'Required'
  else if (loadMasterRules().some((rule) => rule.name?.toLowerCase() === name.toLowerCase())) {
    errors.ruleName = 'This rule name is already used'
  }

  schedule.forEach((entry, i) => {
    const fail = (field, text) => {
      errors[errorKey(entry, field)] = text
    }
    if (!entry.type.trim()) fail('type', 'Required')
    for (const { name: field } of idealFields) {
      if (!entry[field].trim()) fail(field, 'Required')
      else if (!isNumberAtLeast(entry[field], 1)) fail(field, 'Must be a number above 0')
    }
    for (const { name: field } of bufferFields) {
      if (!entry[field].trim()) fail(field, 'Required')
      else if (!isNumberAtLeast(entry[field], 0)) fail(field, 'Must be 0 or more')
    }
    // The window cannot start below 0.
    for (const [lower, ideal, label] of [
      ['daysLower', 'days', daysLabel(i).replace(' (Days)', '')],
      ['kmLower', 'km', 'Service Due After'],
    ]) {
      if (!errors[errorKey(entry, lower)] && !errors[errorKey(entry, ideal)] && Number(entry[lower]) > Number(entry[ideal])) {
        fail(lower, `Cannot be more than ${label}`)
      }
    }
    if (entry.base !== 'invoice' && entry.recursive === 'yes') {
      const count = Number(entry.count)
      if (!entry.count.trim() || !Number.isInteger(count) || count < 2) fail('count', 'Enter a whole number, 2 or more')
      if (!entry.kmInterval.trim()) fail('kmInterval', 'Required')
      else if (!isNumberAtLeast(entry.kmInterval, 1)) fail('kmInterval', 'Must be a number above 0')
    }
  })
  return errors
}

// Rule schedule from the form; serviceNo is the service's position (1, 2, 3 ...).
// Values are read leniently so the service labels can update while typing.
function scheduleFromForm(schedule) {
  return schedule.map((entry, i) => {
    const { type, base, recursive, count, kmInterval } = entry
    const repeats = base !== 'invoice' && recursive === 'yes'
    return {
      serviceNo: i + 1,
      type: type.trim(),
      ...Object.fromEntries(numberFields.map(({ name }) => [name, Number(entry[name])])),
      base: base === 'invoice' || repeats ? base : 'actual',
      recursive: repeats,
      count: repeats ? Math.max(1, Math.floor(Number(count)) || 1) : 1,
      ...(repeats && { kmInterval: Number(kmInterval) }),
    }
  })
}

const num = (value) => value.toLocaleString('en-IN')

// e.g. "Due 15–45 days and 500–1,500 km after the invoice date." once all the numbers are filled in.
function dueText(entry, i) {
  const after = i === 0 ? 'the invoice date' : 'the previous service'
  if (!numberFields.every(({ name }) => isNumberAtLeast(entry[name], 0))) {
    return `Days and km are counted from ${after}.`
  }
  const { daysMin, daysMax, kmMin, kmMax } = windowOf(Object.fromEntries(numberFields.map(({ name }) => [name, Number(entry[name])])))
  return `Due ${num(daysMin)}–${num(daysMax)} days and ${num(kmMin)}–${num(kmMax)} km after ${after}.`
}

const steps = [
  { label: 'Service Rule', caption: 'KM and day schedule' },
  { label: 'Tag', caption: 'Assign a tag to this rule' },
]

// A tag gets one rule, so only tags without a rule can be picked.
const loadOpenTags = () => loadTags().filter((tag) => !tag.ruleId)

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'
const secondaryButton =
  'rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

// Steps in a row, each joined to the next by a line that turns dark once the step is done.
function Stepper({ current }) {
  return (
    <ol className="mb-6 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 sm:gap-4 sm:px-6">
      {steps.map(({ label, caption }, i) => {
        const done = i < current
        const active = i === current
        const last = i === steps.length - 1
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={`flex items-center gap-3 sm:gap-4 ${last ? '' : 'flex-1'}`}
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done
                  ? 'bg-neutral-900 text-white'
                  : active
                    ? 'bg-brand text-neutral-950 ring-4 ring-brand/30'
                    : 'border-2 border-neutral-300 bg-white text-neutral-500'
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
            <span className="shrink-0">
              <span className={`block text-sm font-semibold ${active || done ? 'text-neutral-900' : 'text-neutral-500'}`}>{label}</span>
              <span className="hidden text-xs text-neutral-500 sm:block">{caption}</span>
            </span>
            {!last && (
              <span className={`h-0.5 flex-1 rounded-full ${done ? 'bg-neutral-900' : 'bg-neutral-200'}`} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function AddMasterRule() {
  const [step, setStep] = useState(0)
  const [ruleName, setRuleName] = useState('')
  const [schedule, setSchedule] = useState(emptySchedule)
  const [errors, setErrors] = useState({})
  const [openTags, setOpenTags] = useState(loadOpenTags)
  const [bikes] = useState(loadBikes)
  const [tagId, setTagId] = useState('')
  const [tagError, setTagError] = useState('')
  const [message, setMessage] = useState('')

  const selectedTag = openTags.find((tag) => tag.id === tagId)
  const bikeCountOf = (tag) => bikes.filter((bike) => bike.tagId === tag.id).length

  const labels = slotLabels(scheduleFromForm(schedule))

  function handleEntryChange(entry, field, value) {
    setSchedule((prev) => prev.map((e) => (e.key === entry.key ? { ...e, [field]: value } : e)))
    setErrors((prev) => ({ ...prev, [errorKey(entry, field)]: undefined }))
    setMessage('')
  }

  // A new service is counted from the previous service by default.
  function handleAddNext() {
    setSchedule((prev) => [...prev, newEntry('', 'actual')])
    setMessage('')
  }

  function handleRuleNext(e) {
    e.preventDefault()
    const nextErrors = validate(ruleName, schedule)
    logTable(`Service rule step submitted: ${ruleName}`, schedule)
    logTable('Errors', nextErrors)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setOpenTags(loadOpenTags())
    setStep(1)
  }

  function handleSave(e) {
    e.preventDefault()
    if (!selectedTag) {
      setTagError('Select a tag')
      return
    }

    const rule = {
      id: crypto.randomUUID(),
      name: ruleName.trim(),
      schedule: scheduleFromForm(schedule),
      createdAt: new Date().toISOString(),
    }
    addMasterRule(rule)
    const tags = loadTags().map((tag) => (tag.id === selectedTag.id ? { ...tag, ruleId: rule.id } : tag))
    saveTags(tags)
    logTable(`Service rule saved: ${rule.name} (tag ${selectedTag.name})`, rule.schedule)
    logTable('service_rules', loadServiceRules())
    logTable('service_rule_items', loadServiceRuleItems())
    logTable('tags', tags)

    setRuleName('')
    setSchedule(emptySchedule())
    setTagId('')
    setOpenTags(loadOpenTags())
    setStep(0)
    setMessage(`Service rule "${rule.name}" saved with tag "${selectedTag.name}".`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Service Plan Setup</h1>
      </div>

      <Stepper current={step} />

      {step === 0 && (
        <form onSubmit={handleRuleNext} noValidate className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
            <div className="max-w-sm">
              <label htmlFor="ruleName" className="block text-sm font-medium text-neutral-700">
                Rule Name <span className="text-neutral-400">*</span>
              </label>
              <input
                id="ruleName"
                type="text"
                value={ruleName}
                onChange={(e) => {
                  setRuleName(e.target.value)
                  setErrors((prev) => ({ ...prev, ruleName: undefined }))
                  setMessage('')
                }}
                placeholder="Activa Standard Plan"
                aria-invalid={Boolean(errors.ruleName)}
                aria-describedby={errors.ruleName ? 'ruleName-error' : undefined}
                className={inputClass(errors.ruleName)}
              />
              {errors.ruleName && (
                <p id="ruleName-error" className="mt-1 text-xs font-medium text-neutral-900">
                  {errors.ruleName}
                </p>
              )}
            </div>
          </div>

          {schedule.map((entry, i) => {
            const fromInvoice = entry.base === 'invoice'
            const example = fromInvoice ? invoiceExample : previousExample
            const fieldError = (field) => errors[errorKey(entry, field)]
            const fieldId = (field) => `${entry.key}-${field}`
            const errorText = (field) =>
              fieldError(field) && (
                <p id={`${fieldId(field)}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                  {fieldError(field)}
                </p>
              )
            const label = (field, text) => (
              <label htmlFor={fieldId(field)} className="block text-sm font-medium text-neutral-700">
                {text} <span className="text-neutral-400">*</span>
              </label>
            )
            const numberInput = (field, placeholder, min = 0) => (
              <input
                id={fieldId(field)}
                type="number"
                inputMode="numeric"
                min={min}
                value={entry[field]}
                onChange={(e) => handleEntryChange(entry, field, e.target.value)}
                placeholder={placeholder}
                aria-invalid={Boolean(fieldError(field))}
                aria-describedby={fieldError(field) ? `${fieldId(field)}-error` : undefined}
                className={inputClass(fieldError(field))}
              />
            )

            return (
              <div key={entry.key} className="rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
                <div className="-mx-5 -mt-5 rounded-t-xl bg-brand px-5 py-3 sm:-mx-6 sm:px-6">
                  <h2 className="text-base font-semibold text-neutral-950">{labels[i]} Rule</h2>
                  <p className="mt-0.5 text-sm text-neutral-800">{dueText(entry, i)}</p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    {label('type', 'Type')}
                    <input
                      id={fieldId('type')}
                      type="text"
                      value={entry.type}
                      onChange={(e) => handleEntryChange(entry, 'type', e.target.value)}
                      readOnly={i === 0}
                      placeholder="PMS"
                      aria-invalid={Boolean(fieldError('type'))}
                      aria-describedby={fieldError('type') ? `${fieldId('type')}-error` : undefined}
                      className={`${inputClass(fieldError('type'))} read-only:bg-neutral-100 read-only:text-neutral-500`}
                    />
                    {errorText('type')}
                  </div>

                  {idealFields.map(({ name, label: text }) => (
                    <div key={name}>
                      {label(name, name === 'days' ? daysLabel(i) : text)}
                      {numberInput(name, String(example[name]), 1)}
                      {errorText(name)}
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {bufferGroups.map(({ title, fields }) => (
                    <fieldset key={title} className="rounded-lg border border-neutral-200 p-4">
                      <legend className="px-1 text-sm font-semibold text-neutral-900">{title}</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {fields.map(({ name, label: text }) => (
                          <div key={name}>
                            {label(name, text)}
                            {numberInput(name, String(example[name]))}
                            {errorText(name)}
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {/* The 1st service is counted from the invoice date, so it is always No and locked. */}
                  <fieldset disabled={i === 0}>
                    <legend className="block text-sm font-medium text-neutral-700">
                      Recursive <span className="text-neutral-400">*</span>
                    </legend>
                    <div className="mt-2.5 flex gap-4">
                      {['yes', 'no'].map((value) => (
                        <label
                          key={value}
                          className={`flex items-center gap-2 text-sm capitalize ${i === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}
                        >
                          <input
                            type="radio"
                            name={fieldId('recursive')}
                            value={value}
                            checked={entry.recursive === value}
                            onChange={() => handleEntryChange(entry, 'recursive', value)}
                            className="size-4 accent-neutral-900"
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {entry.recursive === 'yes' && (
                    <>
                      <div>
                        {label('count', 'Count')}
                        {numberInput('count', '5', 2)}
                        {errorText('count')}
                      </div>

                      <div>
                        {label('kmInterval', 'Odometer Interval (km)')}
                        {numberInput('kmInterval', '4000', 1)}
                        {errorText('kmInterval')}
                      </div>

                      <fieldset className="sm:col-span-2">
                        <legend className="block text-sm font-medium text-neutral-700">
                          Project from <span className="text-neutral-400">*</span>
                        </legend>
                        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                          {baseOptions.map(({ value, label: text }) => (
                            <label key={value} className="flex items-center gap-2 text-sm text-neutral-900">
                              <input
                                type="radio"
                                name={fieldId('base')}
                                value={value}
                                checked={entry.base === value}
                                onChange={() => handleEntryChange(entry, 'base', value)}
                                className="size-4 accent-neutral-900"
                              />
                              {text}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleAddNext} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Rule
            </button>
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
              rule={{ name: ruleName.trim(), schedule: scheduleFromForm(schedule) }}
              tagName={selectedTag?.name}
              bikeCount={selectedTag ? bikeCountOf(selectedTag) : undefined}
            />
          </aside>

          <form onSubmit={handleSave} noValidate className="rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 p-5 sm:px-6">
              <h2 className="text-base font-semibold">Tag</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Pick the tag for this rule. Only tags without a service rule are shown. Create tags on the{' '}
                <Link to="/tags" className="font-medium text-neutral-900 underline">
                  Tags
                </Link>{' '}
                page.
              </p>

              {openTags.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center">
                  <h3 className="text-sm font-semibold">No free tags</h3>
                  <p className="mt-1 text-sm text-neutral-500">Every tag already has a service rule. Create a new tag first.</p>
                </div>
              ) : (
                <fieldset className="mt-4" aria-describedby={tagError ? 'tagId-error' : undefined}>
                  <legend className="sr-only">Tag</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {openTags.map((tag) => (
                      <label
                        key={tag.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                          tag.id === tagId ? 'border-neutral-900 bg-brand/15' : 'border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tagId"
                          value={tag.id}
                          checked={tag.id === tagId}
                          onChange={() => {
                            setTagId(tag.id)
                            setTagError('')
                          }}
                          className="size-4 accent-neutral-900"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{tag.name}</span>
                        <span className="text-xs text-neutral-500">
                          {bikeCountOf(tag)} bike{bikeCountOf(tag) === 1 ? '' : 's'}
                        </span>
                      </label>
                    ))}
                  </div>
                  {tagError && (
                    <p id="tagId-error" className="mt-2 text-xs font-medium text-neutral-900">
                      {tagError}
                    </p>
                  )}
                </fieldset>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 p-5 sm:px-6">
              <button type="button" onClick={() => setStep(0)} className={secondaryButton}>
                Back
              </button>
              <button type="submit" disabled={openTags.length === 0} className={`${primaryButton} disabled:opacity-50`}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default AddMasterRule
