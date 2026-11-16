import { useState } from 'react'
import { loadParts, saveParts } from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

const fields = [{ name: 'name', label: 'Part Name', placeholder: 'Engine Oil' }]

const emptyPart = { name: '' }

function validate(part, parts) {
  const errors = {}
  const name = part.name.trim()
  if (!name) errors.name = 'Required'
  else if (parts.some((p) => p.name.toLowerCase() === name.toLowerCase())) errors.name = 'This part is already added'
  return errors
}

function Parts() {
  const [parts, setParts] = useState(loadParts)
  const [part, setPart] = useState(emptyPart)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const nextErrors = validate(part, parts)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }

    const saved = {
      id: crypto.randomUUID(),
      name: part.name.trim(),
      createdAt: new Date().toISOString(),
    }
    const nextParts = [...parts, saved]
    saveParts(nextParts)
    logTable('Part added', saved)
    logTable('parts', nextParts)
    setParts(nextParts)
    setPart(emptyPart)
    setMessage(`Part "${saved.name}" added.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Parts</h1>
        <p className="mt-1 text-sm text-neutral-500">Add spare parts. Assign them to models on the Assign Parts page.</p>
      </div>

      <form onSubmit={handleAdd} noValidate className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
        <h2 className="text-base font-semibold">Add Part</h2>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          {fields.map(({ name, label, placeholder }) => (
            <div key={name}>
              <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                {label} <span className="text-neutral-400">*</span>
              </label>
              <input
                id={name}
                type="text"
                value={part[name]}
                onChange={(e) => {
                  setPart((prev) => ({ ...prev, [name]: e.target.value }))
                  setErrors((prev) => ({ ...prev, [name]: undefined }))
                  setMessage('')
                }}
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
          <button type="submit" className={`${primaryButton} lg:mt-7`}>
            Add
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
      </form>

      {parts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No parts yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Parts you add will show up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-16 px-4 py-3">#</th>
                <th className="px-4 py-3">Part</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {parts.map((p, i) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 tabular-nums text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{p.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Parts
