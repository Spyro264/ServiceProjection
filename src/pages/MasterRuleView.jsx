import { useState } from 'react'
import ServiceEntryCard from '../components/ServiceEntryCard.jsx'
import { entryDetail, ruleSummary, ruleTitle, scheduleOf, slotLabels } from '../lib/projection.js'
import { entryToForm, errorKey, scheduleFromForm, validateSchedule } from '../lib/ruleForm.js'
import {
  loadBikes,
  loadMasterRules,
  loadServiceRules,
  loadTags,
  loadTypes,
  updateMasterRuleSchedule,
} from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const num = (value) => value.toLocaleString('en-IN')

const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-neutral-500'

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'
const secondaryButton =
  'rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

// Errors for the service being edited: the setup form's checks, plus it must still come before the next service.
function editErrors(form, i) {
  const entry = form[i]
  const errors = Object.fromEntries(Object.entries(validateSchedule(form)).filter(([key]) => key.startsWith(`${entry.key}.`)))
  const next = form[i + 1]
  for (const field of ['days', 'km']) {
    if (next && !errors[errorKey(entry, field)] && Number(entry[field]) >= Number(next[field])) {
      errors[errorKey(entry, field)] = `Must be less than the next service (${num(Number(next[field]))} ${field})`
    }
  }
  return errors
}

function ScheduleTile({ label, entry, editing, onEdit }) {
  // Every service's window is counted from the invoice date. Recursive entries (with repeats) are highlighted.
  const chained = Boolean(entry.recursive)
  return (
    <div
      className={`flex flex-col rounded-lg border p-3 ${chained ? 'border-brand bg-brand/15' : 'border-neutral-200 bg-neutral-50'} ${
        editing ? 'ring-2 ring-neutral-900' : ''
      }`}
    >
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500">
        <span className="whitespace-nowrap">{label}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${
            chained ? 'bg-neutral-950 text-brand' : 'bg-white text-neutral-500 ring-1 ring-neutral-200'
          }`}
        >
          {entry.type}
        </span>
      </p>
      <p className="mt-2 text-base font-semibold tabular-nums text-neutral-900">
        {num(entry.kmMin)}–{num(entry.kmMax)} km
      </p>
      <p className="text-xs tabular-nums text-neutral-500">
        {num(entry.daysMin)}–{num(entry.daysMax)} days
      </p>
      <p className="mt-1 text-xs text-neutral-600">{entryDetail(entry)}</p>
      {onEdit && (
        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={onEdit}
            aria-pressed={editing}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

// One service plan: rule + tag + its bikes. When `editable`, each service has an Edit button that opens its form below
// the schedule. `editing` holds the whole schedule as form values, so the edited service can be checked against the others.
function PlanCard({ rule, tag, bikes, types, editable, onSaved }) {
  const schedule = scheduleOf(rule)
  const labels = slotLabels(schedule)
  const [editing, setEditing] = useState(null)

  function handleEdit(i) {
    setEditing({ i, form: rule.schedule.map(entryToForm), errors: {} })
  }

  function handleChange(field, value) {
    setEditing((prev) => {
      const entry = prev.form[prev.i]
      return {
        ...prev,
        form: prev.form.map((e) => (e === entry ? { ...e, [field]: value } : e)),
        errors: { ...prev.errors, [errorKey(entry, field)]: undefined },
      }
    })
  }

  function handleSave(e) {
    e.preventDefault()
    const errors = editErrors(editing.form, editing.i)
    logTable(`Service edit submitted: ${ruleTitle(rule)} (${labels[editing.i]})`, editing.form[editing.i])
    logTable('Errors', errors)
    if (Object.keys(errors).length > 0) {
      setEditing((prev) => ({ ...prev, errors }))
      return
    }
    const updated = scheduleFromForm(editing.form)
    updateMasterRuleSchedule(rule.id, updated)
    logTable(`Service rule updated: ${ruleTitle(rule)}`, updated)
    setEditing(null)
    onSaved(`${labels[editing.i]} of "${ruleTitle(rule)}" updated. Vehicles already projected keep their current due service; the change applies from their next projection.`)
  }

  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 p-5 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {tag ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-2.5 py-1 text-sm font-semibold text-brand">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                {tag.name}
              </span>
            ) : (
              <span className="rounded-md border border-dashed border-neutral-300 px-2.5 py-1 text-sm text-neutral-500">No tag</span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">{ruleTitle(rule)}</h2>
          {rule.name && <p className="text-sm text-neutral-500">{ruleSummary(rule)}</p>}
          {/* Rules saved before model and year were removed from the form still have them. */}
          {rule.model && (
            <p className="text-sm text-neutral-500">
              {rule.model} · {rule.year}
            </p>
          )}
        </div>
      </header>

      <section className="border-b border-neutral-200 p-5 sm:px-6">
        <h3 className={sectionLabel}>Service schedule</h3>
        <p className="mt-1 text-xs text-neutral-500">Days and odo are counted from the invoice date, or added to the previous service (+).</p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
          {schedule.map((entry, i) => (
            <ScheduleTile
              key={i}
              label={labels[i]}
              entry={entry}
              editing={editing?.i === i}
              onEdit={editable ? () => handleEdit(i) : undefined}
            />
          ))}
        </div>

        {editing && (
          <form onSubmit={handleSave} noValidate className="mt-4 space-y-3">
            <ServiceEntryCard
              entry={editing.form[editing.i]}
              i={editing.i}
              heading={`Edit ${slotLabels(scheduleFromForm(editing.form))[editing.i]} Rule`}
              errors={editing.errors}
              types={types}
              onChange={handleChange}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
                Cancel
              </button>
              <button type="submit" className={primaryButton}>
                Save
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="p-5 sm:px-6">
        <h3 className={sectionLabel}>
          Bikes <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">{bikes.length}</span>
        </h3>
        {bikes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {tag ? 'No bikes yet. Assign bikes to this tag on the Tags page.' : 'This rule has no tag, so it has no bikes.'}
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {bikes.map((bike) => (
              <li key={bike.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm">
                <span className="font-medium text-neutral-900">{bike.regNo}</span>
                <span className="ml-2 text-xs text-neutral-500">{bike.model}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}

function MasterRuleView() {
  const [rules, setRules] = useState(loadMasterRules)
  const [tags] = useState(loadTags)
  const [bikes] = useState(loadBikes)
  const [types] = useState(loadTypes)
  const [message, setMessage] = useState('')

  const tagByRule = Object.fromEntries(tags.map((tag) => [tag.ruleId, tag]))
  // Only rules saved as service_rules rows with days / km on every service can be edited;
  // rules in the older formats are shown as they are.
  const editableIds = new Set(loadServiceRules().map((rule) => rule.id))
  const isEditable = (rule) => editableIds.has(rule.id) && rule.schedule.every((entry) => entry.days != null)

  function handleSaved(text) {
    setRules(loadMasterRules())
    setMessage(text)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Service Plans</h1>
        <p className="mt-1 text-sm text-neutral-500">All saved service rules with their tag and bikes.</p>
      </div>

      {message && (
        <p role="status" className="mb-4 rounded-xl border border-brand bg-brand/15 p-4 text-sm text-neutral-900">
          {message}
        </p>
      )}

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No service plans yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Plans you set up will show up here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rules.map((rule) => {
            const tag = tagByRule[rule.id]
            return (
              <PlanCard
                key={rule.id}
                rule={rule}
                tag={tag}
                bikes={tag ? bikes.filter((bike) => bike.tagId === tag.id) : []}
                types={types}
                editable={isEditable(rule)}
                onSaved={handleSaved}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MasterRuleView
