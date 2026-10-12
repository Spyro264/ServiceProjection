import { useState } from 'react'
import { ruleTitle } from '../lib/projection.js'
import { loadBikes, loadMasterRules, loadTags, saveTags } from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-neutral-500'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

function TagIcon(props) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  )
}

function TagCard({ tag, rule, bikes }) {
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
      </header>

      <section className="p-5 sm:px-6">
        <h3 className={sectionLabel}>
          Bikes <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">{bikes.length}</span>
        </h3>
        {bikes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No bikes yet. Bikes get this tag when they are onboarded.</p>
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
  const [bikes] = useState(loadBikes)
  const [tagName, setTagName] = useState('')
  const [tagError, setTagError] = useState('')
  const [message, setMessage] = useState('')

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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="mt-1 text-sm text-neutral-500">Create tags. Bikes get a tag on the Onboard Vehicles page.</p>
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Tags
