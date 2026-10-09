import { useState } from 'react'
import { entryDetail, ruleSummary, ruleTitle, scheduleOf, slotLabels } from '../lib/projection.js'
import { loadBikes, loadMasterRules, loadTags } from '../lib/storage.js'

const num = (value) => value.toLocaleString('en-IN')

const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-neutral-500'

function ScheduleTile({ label, entry }) {
  // Entries counted from a previous service are highlighted; their limits are added on.
  const chained = entry.base !== 'invoice'
  const plus = chained ? '+' : ''
  return (
    <div className={`rounded-lg border p-3 ${chained ? 'border-brand bg-brand/15' : 'border-neutral-200 bg-neutral-50'}`}>
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
        {plus}
        {num(entry.kmMin)}–{num(entry.kmMax)} km
      </p>
      <p className="text-xs tabular-nums text-neutral-500">
        {plus}
        {num(entry.daysMin)}–{num(entry.daysMax)} days
      </p>
      <p className="mt-1 text-xs text-neutral-600">{entryDetail(entry)}</p>
    </div>
  )
}

// One service plan: rule + tag + its bikes.
function PlanCard({ rule, tag, bikes }) {
  const schedule = scheduleOf(rule)
  const labels = slotLabels(schedule)

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
            <ScheduleTile key={i} label={labels[i]} entry={entry} />
          ))}
        </div>
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
  const [rules] = useState(loadMasterRules)
  const [tags] = useState(loadTags)
  const [bikes] = useState(loadBikes)

  const tagByRule = Object.fromEntries(tags.map((tag) => [tag.ruleId, tag]))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Service Plans</h1>
        <p className="mt-1 text-sm text-neutral-500">All saved service rules with their tag and bikes.</p>
      </div>

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
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MasterRuleView
