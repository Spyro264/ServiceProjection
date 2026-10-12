import { useState } from 'react'
import { Link } from 'react-router'
import RulePlanCard from '../components/RulePlanCard.jsx'
import ServiceEntryCard from '../components/ServiceEntryCard.jsx'
import ServicePreview from '../components/ServicePreview.jsx'
import { slotLabels } from '../lib/projection.js'
import { emptySchedule, errorKey, newEntry, scheduleFromForm, validateSchedule } from '../lib/ruleForm.js'
import {
  addMasterRule,
  loadBikes,
  loadMasterRules,
  loadServiceRuleItems,
  loadServiceRules,
  loadTags,
  loadTypes,
  saveTags,
} from '../lib/storage.js'
import { logTable } from '../lib/log.js'

function validate(ruleName, schedule) {
  const errors = {}
  const name = ruleName.trim()
  if (!name) errors.ruleName = 'Required'
  else if (loadMasterRules().some((rule) => rule.name?.toLowerCase() === name.toLowerCase())) {
    errors.ruleName = 'This rule name is already used'
  }
  return { ...errors, ...validateSchedule(schedule) }
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
  const [showPreview, setShowPreview] = useState(false)
  const [openTags, setOpenTags] = useState(loadOpenTags)
  const [bikes] = useState(loadBikes)
  const [types] = useState(loadTypes)
  const [tagId, setTagId] = useState('')
  const [tagError, setTagError] = useState('')
  const [message, setMessage] = useState('')

  const selectedTag = openTags.find((tag) => tag.id === tagId)
  const bikeCountOf = (tag) => bikes.filter((bike) => bike.tagId === tag.id).length

  const labels = slotLabels(scheduleFromForm(schedule))
  // The preview needs every number filled in correctly; the type is only a label, so it is not needed.
  const previewReady = Object.keys(validateSchedule(schedule)).every((key) => key.endsWith('.type'))

  function handleEntryChange(entry, field, value) {
    setSchedule((prev) => prev.map((e) => (e.key === entry.key ? { ...e, [field]: value } : e)))
    setErrors((prev) => ({ ...prev, [errorKey(entry, field)]: undefined }))
    setMessage('')
  }

  // A new service's repeats (if made recursive) are counted from the previous service by default.
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
    <div className={`mx-auto ${step === 0 && showPreview ? 'max-w-[96rem]' : 'max-w-6xl'}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Service Plan Setup</h1>
        {step === 0 && (
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            aria-expanded={showPreview}
            className={`${secondaryButton} inline-flex items-center gap-2`}
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        )}
      </div>

      <Stepper current={step} />

      {step === 0 && (
        <div className={showPreview ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]' : ''}>
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

            {schedule.map((entry, i) => (
              <ServiceEntryCard
                key={entry.key}
                entry={entry}
                i={i}
                heading={`${labels[i]} Rule`}
                errors={errors}
                types={types}
                onChange={(field, value) => handleEntryChange(entry, field, value)}
              />
            ))}

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

          {showPreview && (
            <aside className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
              <ServicePreview rule={{ schedule: scheduleFromForm(schedule) }} ready={previewReady} />
            </aside>
          )}
        </div>
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
