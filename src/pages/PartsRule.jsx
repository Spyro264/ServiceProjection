import { useState } from 'react'
import { Link } from 'react-router'
import MultiSelect from '../components/MultiSelect.jsx'
import { serviceLabel } from '../lib/projection.js'
import {
  loadBikeModels,
  loadModelParts,
  loadParts,
  loadPartsForModel,
  loadPartsRuleItems,
  loadPartsRules,
  loadPartsRuleServices,
  savePartsRule,
} from '../lib/storage.js'
import { logTable } from '../lib/log.js'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'
const secondaryButton =
  'rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

// One service of the form: the parts replaced at that service number (its position).
const newService = () => ({ key: crypto.randomUUID(), partIds: [] })

// Models that have parts assigned. A model with a saved parts rule can still be picked to edit that rule.
function loadModelsWithParts() {
  const assigned = loadModelParts()
  return loadBikeModels().filter((model) => assigned.some((row) => row.model === model))
}

// The form's service cards for a model: its saved rule if it has one, else one empty card.
function servicesFor(model) {
  const saved = model ? loadPartsRuleServices(model) : null
  return saved?.length ? saved.map(({ partIds }) => ({ key: crypto.randomUUID(), partIds })) : [newService()]
}

function validate(model, services) {
  const errors = {}
  if (!model) errors.model = 'Select a model'
  for (const service of services) {
    if (service.partIds.length === 0) errors[service.key] = 'Pick at least one part'
  }
  return errors
}

function PartsRule() {
  const [models] = useState(loadModelsWithParts)
  const [parts] = useState(loadParts)
  const [model, setModel] = useState('')
  const [services, setServices] = useState(() => [newService()])
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [hasSavedRule, setHasSavedRule] = useState(false)

  const modelParts = model ? loadPartsForModel(model) : []

  function setPartIds(service, partIds) {
    setServices((prev) => prev.map((s) => (s.key === service.key ? { ...s, partIds } : s)))
    setErrors((prev) => ({ ...prev, [service.key]: undefined }))
    setMessage('')
  }

  function handleAddNext() {
    setServices((prev) => [...prev, newService()])
    setMessage('')
  }

  function handleSave(e) {
    e.preventDefault()
    const nextErrors = validate(model, services)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }

    const ruleServices = services.map((service, i) => ({ serviceNo: i + 1, partIds: service.partIds }))
    savePartsRule(model, ruleServices)
    const partName = Object.fromEntries(parts.map((part) => [part.id, part.name]))
    logTable(
      `Parts rule saved: ${model}`,
      ruleServices.map(({ serviceNo, partIds }) => ({
        service: serviceLabel(serviceNo),
        parts: partIds.map((id) => partName[id]).join(', '),
      })),
    )
    logTable('parts_rules', loadPartsRules())
    logTable('parts_rule_items', loadPartsRuleItems())

    // The form stays as saved so the rule can be checked or edited further.
    setHasSavedRule(true)
    setMessage(`Parts rule for ${model} saved.`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Parts Rule</h1>
        <p className="mt-1 text-sm text-neutral-500">Pick a model and the parts replaced at each service number.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
                  const next = e.target.value
                  setModel(next)
                  // Load the model's saved rule to edit, or start with one empty card.
                  setServices(servicesFor(next))
                  setHasSavedRule(Boolean(next && loadPartsRuleServices(next)))
                  setErrors({})
                  setMessage('')
                }}
                aria-invalid={Boolean(errors.model)}
                aria-describedby={errors.model ? 'model-error' : undefined}
                className={inputClass(errors.model)}
              >
                <option value="">{models.length ? 'Select a model' : 'No models available'}</option>
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
              {hasSavedRule && <p className="mt-1 text-xs text-neutral-500">This model already has a parts rule. Saving replaces it.</p>}
              {models.length === 0 && (
                <p className="mt-1 text-xs text-neutral-500">
                  Only models with assigned parts are shown. Assign parts on the{' '}
                  <Link to="/assign-parts" className="font-medium text-neutral-900 underline">
                    Assign Parts
                  </Link>{' '}
                  page first.
                </p>
              )}
            </div>
          </div>

          {services.map((service, i) => (
            <div key={service.key} className="rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
              <div className="-mx-5 -mt-5 rounded-t-xl bg-brand px-5 py-3 sm:-mx-6 sm:px-6">
                <h2 className="text-base font-semibold text-neutral-950">{serviceLabel(i + 1)} Rule</h2>
                <p className="mt-0.5 text-sm text-neutral-800">
                  {service.partIds.length} part{service.partIds.length === 1 ? '' : 's'} replaced at this service.
                </p>
              </div>

              <div className="mt-4 max-w-xl">
                <label htmlFor={`${service.key}-parts`} className="block text-sm font-medium text-neutral-700">
                  Parts <span className="text-neutral-400">*</span>
                </label>
                {!model ? (
                  <p className="mt-2 text-sm text-neutral-500">Select a model to see its parts.</p>
                ) : (
                  <MultiSelect
                    id={`${service.key}-parts`}
                    options={modelParts.map((part) => ({ value: part.id, label: part.name }))}
                    value={service.partIds}
                    onChange={(partIds) => setPartIds(service, partIds)}
                    placeholder="Select parts"
                    error={errors[service.key]}
                    describedBy={errors[service.key] ? `${service.key}-error` : undefined}
                  />
                )}
                {errors[service.key] && (
                  <p id={`${service.key}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                    {errors[service.key]}
                  </p>
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleAddNext} className={`${secondaryButton} inline-flex items-center gap-2`}>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Rule
            </button>
            <button type="submit" className={primaryButton}>
              Save
            </button>
            {message && <p className="text-sm text-neutral-600">{message}</p>}
          </div>
        </form>

        <aside className="rounded-xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-6">
          <h2 className="text-base font-semibold">Available Parts</h2>
          {!model ? (
            <p className="mt-1 text-sm text-neutral-500">Select a model to see its parts.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-neutral-500">
                {modelParts.length} part{modelParts.length === 1 ? '' : 's'} assigned to {model}.
              </p>
              <ul className="mt-3 max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto">
                {modelParts.map((part) => (
                  <li key={part.id} className="py-2 text-sm font-medium text-neutral-900">
                    {part.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

export default PartsRule
