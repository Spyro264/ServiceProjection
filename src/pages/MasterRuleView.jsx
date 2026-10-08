import { useState } from 'react'
import BikePicker from '../components/BikePicker.jsx'
import { freeServicesOf, ordinal, ruleSummary } from '../lib/projection.js'
import { assignBikesToTag, loadBikes, loadMasterRules, loadTags } from '../lib/storage.js'

const num = (value) => value.toLocaleString('en-IN')

const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-neutral-500'

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'
const secondaryButton =
  'rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

function AddVehiclesDialog({ tag, freeBikes, onSave, onClose }) {
  const [selected, setSelected] = useState([])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-950/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-vehicles-title"
        className="relative flex max-h-full w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-neutral-200 p-5 sm:px-6">
          <h2 id="add-vehicles-title" className="text-base font-semibold">
            Add vehicles to &ldquo;{tag.name}&rdquo;
          </h2>
          <p className="mt-1 text-sm text-neutral-500">Only bikes without a tag are shown.</p>
        </div>
        <div className="overflow-y-auto p-5 sm:px-6">
          <BikePicker bikes={freeBikes} selected={selected} onChange={setSelected} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 p-5 sm:px-6">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(selected)} disabled={selected.length === 0} className={`${primaryButton} disabled:opacity-50`}>
            Save
          </button>
          <p className="text-sm text-neutral-600">
            {selected.length} bike{selected.length === 1 ? '' : 's'} selected
          </p>
        </div>
      </div>
    </div>
  )
}

function ScheduleTile({ label, type, km, days, highlight }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-brand bg-brand/15' : 'border-neutral-200 bg-neutral-50'}`}>
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-500">
        <span className="whitespace-nowrap">{label}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide ${
            highlight ? 'bg-neutral-950 text-brand' : 'bg-white text-neutral-500 ring-1 ring-neutral-200'
          }`}
        >
          {type}
        </span>
      </p>
      <p className="mt-2 text-base font-semibold tabular-nums text-neutral-900">{num(km)} km</p>
      <p className="text-xs tabular-nums text-neutral-500">{num(days)} days</p>
    </div>
  )
}

// One service plan: rule + tag + its bikes.
function PlanCard({ rule, tag, bikes, onAddVehicles }) {
  const free = freeServicesOf(rule)

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
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">{ruleSummary(rule)}</h2>
          {/* Rules saved before model and year were removed from the form still have them. */}
          {rule.model && (
            <p className="text-sm text-neutral-500">
              {rule.model} · {rule.year}
            </p>
          )}
        </div>

        {tag && (
          <button
            type="button"
            onClick={onAddVehicles}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add vehicles
          </button>
        )}
      </header>

      <section className="border-b border-neutral-200 p-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={sectionLabel}>Service schedule</h3>
          <p className="text-xs text-neutral-500">
            Grace window <span className="font-medium tabular-nums text-neutral-700">+{num(rule.kmLimit)} km · +{num(rule.dayLimit)} days</span>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
          {free.map(({ km, days }, i) => (
            <ScheduleTile key={i} label={`${ordinal(i + 1)} service`} type="Free" km={km} days={days} />
          ))}
          <ScheduleTile label="Then every" type="PMS" km={rule.recursiveKm} days={rule.recursiveDays} highlight />
        </div>
      </section>

      <section className="p-5 sm:px-6">
        <h3 className={sectionLabel}>
          Bikes <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">{bikes.length}</span>
        </h3>
        {bikes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {tag ? 'No bikes yet. Use Add vehicles to assign some.' : 'This rule has no tag, so bikes cannot be assigned.'}
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
  const [bikes, setBikes] = useState(loadBikes)
  const [addingTo, setAddingTo] = useState(null)

  const tagByRule = Object.fromEntries(tags.map((tag) => [tag.ruleId, tag]))

  function handleAddVehicles(bikeIds) {
    const nextBikes = assignBikesToTag(bikeIds, addingTo.id)
    console.log('Vehicles added to tag', { tag: addingTo, bikeIds })
    console.log('bikes', nextBikes)
    setBikes(nextBikes)
    setAddingTo(null)
  }

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
                onAddVehicles={() => setAddingTo(tag)}
              />
            )
          })}
        </div>
      )}

      {addingTo && (
        <AddVehiclesDialog
          tag={addingTo}
          freeBikes={bikes.filter((bike) => !bike.tagId)}
          onSave={handleAddVehicles}
          onClose={() => setAddingTo(null)}
        />
      )}
    </div>
  )
}

export default MasterRuleView
