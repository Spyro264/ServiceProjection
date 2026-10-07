import { useState } from 'react'
import { loadMasterRules, saveMasterRules } from '../lib/storage.js'

const sections = [
  {
    title: 'Vehicle',
    fields: [
      { name: 'model', label: 'Model', type: 'text', placeholder: 'Activa 6G' },
      { name: 'year', label: 'Year', placeholder: '2026' },
    ],
  },
  {
    title: 'KM Rules',
    fields: [
      { name: 'firstServiceKm', label: '1st Service (km)', placeholder: '1000' },
      { name: 'secondServiceKm', label: '2nd Service (km)', placeholder: '4000' },
      { name: 'thirdServiceKm', label: '3rd Service (km)', placeholder: '8000' },
      { name: 'recursiveKm', label: 'Recursive KM', placeholder: '4000' },
      { name: 'kmLimit', label: 'KM Limit', placeholder: '500' },
    ],
  },
  {
    title: 'Day Rules',
    fields: [
      { name: 'firstServiceDays', label: '1st Days', placeholder: '30' },
      { name: 'secondServiceDays', label: '2nd Days', placeholder: '90' },
      { name: 'thirdServiceDays', label: '3rd Days', placeholder: '150' },
      { name: 'recursiveDays', label: 'Recursive Days', placeholder: '60' },
      { name: 'dayLimit', label: 'Day Limit', placeholder: '15' },
    ],
  },
]

const fields = sections.flatMap((s) => s.fields)

const emptyForm = { ...Object.fromEntries(fields.map(({ name }) => [name, ''])), kmLimit: '500' }

function validate(form) {
  const errors = {}
  for (const { name, type } of fields) {
    const value = form[name].trim()
    if (!value) errors[name] = 'Required'
    else if (type !== 'text' && !(Number(value) > 0)) errors[name] = 'Must be a number above 0'
  }
  if (!errors.year && !/^\d{4}$/.test(form.year.trim())) errors.year = 'Enter a 4-digit year'
  return errors
}

function AddMasterRule() {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    setMessage('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate(form)
    console.log('Master rule submitted', { form, errors: nextErrors })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const rule = {
      id: crypto.randomUUID(),
      ...Object.fromEntries(
        fields.map(({ name, type }) => [name, type === 'text' ? form[name].trim() : Number(form[name])]),
      ),
      createdAt: new Date().toISOString(),
    }
    const masterTable = [rule, ...loadMasterRules()]
    saveMasterRules(masterTable)
    console.log('Master rule saved', rule)
    console.log('mastertable', masterTable)
    setForm(emptyForm)
    setMessage(`Master rule for ${rule.model} (${rule.year}) saved.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Add Master Rule</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-neutral-200 bg-white">
        {sections.map(({ title, fields: sectionFields }) => (
          <div key={title} className="border-b border-neutral-200 p-5 sm:px-6">
            <h2 className="text-base font-semibold">{title}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {sectionFields.map(({ name, label, placeholder, type = 'number' }) => (
                <div key={name}>
                  <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                    {label} <span className="text-neutral-400">*</span>
                  </label>
                  <input
                    id={name}
                    name={name}
                    type={type}
                    inputMode={type === 'number' ? 'numeric' : undefined}
                    min={type === 'number' ? 1 : undefined}
                    value={form[name]}
                    onChange={handleChange}
                    placeholder={placeholder}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={errors[name] ? `${name}-error` : undefined}
                    className={`mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
                      errors[name]
                        ? 'border-neutral-900 focus:ring-neutral-900/20'
                        : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
                    }`}
                  />
                  {errors[name] && (
                    <p id={`${name}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                      {errors[name]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 p-5 sm:px-6">
          <button
            type="submit"
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
          >
            Save
          </button>
          {message && <p className="text-sm text-neutral-600">{message}</p>}
        </div>
      </form>
    </div>
  )
}

export default AddMasterRule
