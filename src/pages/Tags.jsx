import { useState } from 'react'
import BikePicker from '../components/BikePicker.jsx'
import { ruleTitle } from '../lib/projection.js'
import { assignBikesToTag, loadBikes, loadMasterRules, loadTags, saveTags } from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-neutral-500'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'
const secondaryButton =
  'rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

function TagIcon(props) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  )
}

function AssignBikesDialog({ tag, freeBikes, onSave, onClose }) {
  const [selected, setSelected] = useState([])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-950/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-bikes-title"
        className="relative flex max-h-full w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-neutral-200 p-5 sm:px-6">
          <h2 id="assign-bikes-title" className="text-base font-semibold">
            Assign bikes to &ldquo;{tag.name}&rdquo;
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

function TagCard({ tag, rule, bikes, onAssignBikes }) {
  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 p-5 sm:px-6">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-2.5 py-1 text-sm font-semibold text-brand">
            <TagIcon className="size-4" />
            {tag.name}
          </span>
          <p className="mt-2 text-sm text-neutral-500">
            {rule ? (
              <>
                Service rule: <span className="font-medium text-neutral-900">{ruleTitle(rule)}</span>
              </>
            ) : (
              'No service rule yet. Pick this tag in Service Plan Setup.'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onAssignBikes}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Assign bikes
        </button>
      </header>

      <section className="p-5 sm:px-6">
        <h3 className={sectionLabel}>
          Bikes <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">{bikes.length}</span>
        </h3>
        {bikes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No bikes yet. Use Assign bikes to add some.</p>
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

function Tags() {
  const [tags, setTags] = useState(loadTags)
  const [rules] = useState(loadMasterRules)
  const [bikes, setBikes] = useState(loadBikes)
  const [tagName, setTagName] = useState('')
  const [tagError, setTagError] = useState('')
  const [message, setMessage] = useState('')
  const [assigningTo, setAssigningTo] = useState(null)

  function handleCreate(e) {
    e.preventDefault()
    const name = tagName.trim()
    let error = ''
    if (!name) error = 'Required'
    else if (tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) error = 'This tag name is already used'
    setTagError(error)
    if (error) return

    // ruleId stays null until the tag is picked for a rule in Service Plan Setup.
    const tag = { id: crypto.randomUUID(), name, ruleId: null, createdAt: new Date().toISOString() }
    const nextTags = [tag, ...tags]
    saveTags(nextTags)
    logTable('Tag created', tag)
    logTable('tags', nextTags)
    setTags(nextTags)
    setTagName('')
    setMessage(`Tag "${name}" created.`)
  }

  function handleAssignBikes(bikeIds) {
    const nextBikes = assignBikesToTag(bikeIds, assigningTo.id)
    logTable('Bikes assigned to tag', { tag: assigningTo.name, tagId: assigningTo.id, bikeIds: bikeIds.join(', ') })
    logTable('bikes', nextBikes)
    setBikes(nextBikes)
    setAssigningTo(null)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="mt-1 text-sm text-neutral-500">Create tags and assign bikes to them.</p>
      </div>

      <form onSubmit={handleCreate} noValidate className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
        <h2 className="text-base font-semibold">Create Tag</h2>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <div className="w-full max-w-sm">
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
                setMessage('')
              }}
              placeholder="Bangalore Fleet"
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
          <button type="submit" className={`${primaryButton} sm:mt-7`}>
            Create
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      </form>

      {tags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No tags yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Tags you create will show up here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {tags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              rule={rules.find((r) => r.id === tag.ruleId)}
              bikes={bikes.filter((bike) => bike.tagId === tag.id)}
              onAssignBikes={() => setAssigningTo(tag)}
            />
          ))}
        </div>
      )}

      {assigningTo && (
        <AssignBikesDialog
          tag={assigningTo}
          freeBikes={bikes.filter((bike) => !bike.tagId)}
          onSave={handleAssignBikes}
          onClose={() => setAssigningTo(null)}
        />
      )}
    </div>
  )
}

export default Tags
