import { useState } from 'react'
import { loadTypes, saveTypes } from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

function Types() {
  const [types, setTypes] = useState(loadTypes)
  const [typeName, setTypeName] = useState('')
  const [typeError, setTypeError] = useState('')
  const [message, setMessage] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const name = typeName.trim()
    let error = ''
    if (!name) error = 'Required'
    else if (types.some((type) => type.name.toLowerCase() === name.toLowerCase())) error = 'This type is already added'
    setTypeError(error)
    if (error) return

    const type = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }
    const nextTypes = [...types, type]
    saveTypes(nextTypes)
    logTable('Type added', type)
    logTable('types', nextTypes)
    setTypes(nextTypes)
    setTypeName('')
    setMessage(`Type "${name}" added.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Add Type</h1>
        <p className="mt-1 text-sm text-neutral-500">Service types to pick from for the 2nd service onward in Service Plan Setup.</p>
      </div>

      <form onSubmit={handleAdd} noValidate className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
        <h2 className="text-base font-semibold">Add Type</h2>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <div className="w-full max-w-sm">
            <label htmlFor="typeName" className="block text-sm font-medium text-neutral-700">
              Type Name <span className="text-neutral-400">*</span>
            </label>
            <input
              id="typeName"
              type="text"
              value={typeName}
              onChange={(e) => {
                setTypeName(e.target.value)
                setTypeError('')
                setMessage('')
              }}
              placeholder="PMS"
              aria-invalid={Boolean(typeError)}
              aria-describedby={typeError ? 'typeName-error' : undefined}
              className={inputClass(typeError)}
            />
            {typeError && (
              <p id="typeName-error" className="mt-1 text-xs font-medium text-neutral-900">
                {typeError}
              </p>
            )}
          </div>
          <button type="submit" className={`${primaryButton} sm:mt-7`}>
            Add
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      </form>

      {types.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No types yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Types you add will show up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-16 px-4 py-3">#</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {types.map((type, i) => (
                <tr key={type.id}>
                  <td className="px-4 py-3 tabular-nums text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{type.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Types
