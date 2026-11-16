import { useState } from 'react'
import { Link } from 'react-router'
import { assignPartsToModel, loadBikeModels, loadModelParts, loadParts } from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

// Part ids currently assigned to a model.
const assignedPartIds = (model) =>
  loadModelParts()
    .filter((row) => row.model === model)
    .map((row) => row.partId)

function AssignParts() {
  const [models] = useState(loadBikeModels)
  const [parts] = useState(loadParts)
  const [model, setModel] = useState('')
  const [partIds, setPartIds] = useState([])
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  // Search only hides parts from view; ticked parts stay ticked even when filtered out.
  const query = search.trim().toLowerCase()
  const shownParts = query ? parts.filter((part) => part.name.toLowerCase().includes(query)) : parts

  function togglePart(partId) {
    setPartIds((prev) => (prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId]))
    setErrors({})
    setMessage('')
  }

  function handleSave(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!model) nextErrors.model = 'Select a model'
    else if (partIds.length === 0) nextErrors.parts = 'Pick at least one part'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }

    const rows = assignPartsToModel(model, partIds)
    const partName = Object.fromEntries(parts.map((part) => [part.id, part.name]))
    logTable(
      `Parts assigned to ${model}`,
      rows.filter((row) => row.model === model).map((row) => ({ model: row.model, part: partName[row.partId] })),
    )
    logTable('model_part_assignments', rows)
    setMessage(`${partIds.length} part${partIds.length === 1 ? '' : 's'} assigned to ${model}.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Assign Parts to Model</h1>
        <p className="mt-1 text-sm text-neutral-500">Pick a bike model and tick the parts it uses.</p>
      </div>

      <form onSubmit={handleSave} noValidate className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
          <div className="max-w-sm">
            <label htmlFor="model" className="block text-sm font-medium text-neutral-700">
              Bike Model <span className="text-neutral-400">*</span>
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                setPartIds(e.target.value ? assignedPartIds(e.target.value) : [])
                setErrors({})
                setMessage('')
              }}
              aria-invalid={Boolean(errors.model)}
              aria-describedby={errors.model ? 'model-error' : undefined}
              className={inputClass(errors.model)}
            >
              <option value="">Select a model</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {errors.model && (
              <p id="model-error" className="mt-1 text-xs font-medium text-neutral-900">
                {errors.model}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
          <fieldset aria-describedby={errors.parts ? 'parts-error' : undefined}>
            <legend className="block text-sm font-medium text-neutral-700">
              Parts <span className="text-neutral-400">*</span>
              {model && <span className="ml-2 font-normal text-neutral-500">{partIds.length} selected</span>}
            </legend>
            {parts.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                No parts yet. Add them on the{' '}
                <Link to="/parts" className="font-medium text-neutral-900 underline">
                  Parts
                </Link>{' '}
                page first.
              </p>
            ) : !model ? (
              <p className="mt-2 text-sm text-neutral-500">Select a model to assign parts.</p>
            ) : (
              <>
                <div className="mt-2.5 max-w-sm">
                  <label htmlFor="part-search" className="sr-only">
                    Search parts
                  </label>
                  <input
                    id="part-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search parts"
                    className={inputClass()}
                  />
                </div>
                {shownParts.length === 0 && <p className="mt-3 text-sm text-neutral-500">No parts match "{search.trim()}".</p>}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shownParts.map((part) => {
                    const checked = partIds.includes(part.id)
                    return (
                      <label
                        key={part.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                          checked ? 'border-neutral-900 bg-brand/15' : 'border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePart(part.id)}
                          className="size-4 accent-neutral-900"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{part.name}</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}
            {errors.parts && (
              <p id="parts-error" className="mt-2 text-xs font-medium text-neutral-900">
                {errors.parts}
              </p>
            )}
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton}>
            Save
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </div>
      </form>
    </div>
  )
}

export default AssignParts
