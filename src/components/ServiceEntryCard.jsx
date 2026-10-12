import { Link } from 'react-router'
import {
  baseOptions,
  bufferGroups,
  daysLabel,
  dueText,
  errorKey,
  idealFields,
  invoiceExample,
  previousExample,
} from '../lib/ruleForm.js'

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

// The form for one service of a rule (form values from ruleForm.js). `i` is its position: the 1st is always Free
// and never recursive. onChange(field, value) is called on every edit.
function ServiceEntryCard({ entry, i, heading, errors, types, onChange }) {
  const fromInvoice = entry.base === 'invoice'
  const example = fromInvoice ? invoiceExample : previousExample
  const fieldError = (field) => errors[errorKey(entry, field)]
  const fieldId = (field) => `${entry.key}-${field}`
  const errorText = (field) =>
    fieldError(field) && (
      <p id={`${fieldId(field)}-error`} className="mt-1 text-xs font-medium text-neutral-900">
        {fieldError(field)}
      </p>
    )
  const label = (field, text) => (
    <label htmlFor={fieldId(field)} className="block text-sm font-medium text-neutral-700">
      {text} <span className="text-neutral-400">*</span>
    </label>
  )
  const numberInput = (field, placeholder, min = 0) => (
    <input
      id={fieldId(field)}
      type="number"
      inputMode="numeric"
      min={min}
      value={entry[field]}
      onChange={(e) => onChange(field, e.target.value)}
      placeholder={placeholder}
      aria-invalid={Boolean(fieldError(field))}
      aria-describedby={fieldError(field) ? `${fieldId(field)}-error` : undefined}
      className={inputClass(fieldError(field))}
    />
  )

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
      <div className="-mx-5 -mt-5 rounded-t-xl bg-brand px-5 py-3 sm:-mx-6 sm:px-6">
        <h2 className="text-base font-semibold text-neutral-950">{heading}</h2>
        <p className="mt-0.5 text-sm text-neutral-800">{dueText(entry, i)}</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          {label('type', 'Type')}
          {/* The 1st service is always Free. Later ones pick from the types added on the Add Type page. */}
          {i === 0 ? (
            <input
              id={fieldId('type')}
              type="text"
              value={entry.type}
              readOnly
              className={`${inputClass()} bg-neutral-100 text-neutral-500`}
            />
          ) : (
            <select
              id={fieldId('type')}
              value={entry.type}
              onChange={(e) => onChange('type', e.target.value)}
              aria-invalid={Boolean(fieldError('type'))}
              aria-describedby={fieldError('type') ? `${fieldId('type')}-error` : undefined}
              className={inputClass(fieldError('type'))}
            >
              <option value="">{types.length ? 'Select a type' : 'No types yet'}</option>
              {/* A saved service keeps its type even if that type is no longer on the Add Type page. */}
              {entry.type && !types.some((type) => type.name === entry.type) && <option value={entry.type}>{entry.type}</option>}
              {types.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          )}
          {errorText('type')}
          {i > 0 && types.length === 0 && !fieldError('type') && (
            <p className="mt-1 text-xs text-neutral-500">
              Add types on the{' '}
              <Link to="/types" className="font-medium text-neutral-900 underline">
                Add Type
              </Link>{' '}
              page first.
            </p>
          )}
        </div>

        {idealFields.map(({ name, label: text }) => (
          <div key={name}>
            {label(name, name === 'days' ? daysLabel(i) : text)}
            {numberInput(name, String(example[name]), 1)}
            {errorText(name)}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {bufferGroups.map(({ title, fields }) => (
          <fieldset key={title} className="rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-sm font-semibold text-neutral-900">{title}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(({ name, label: text }) => (
                <div key={name}>
                  {label(name, text)}
                  {numberInput(name, String(example[name]))}
                  {errorText(name)}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* The 1st service is counted from the invoice date, so it is always No and locked. */}
        <fieldset disabled={i === 0}>
          <legend className="block text-sm font-medium text-neutral-700">
            Recursive <span className="text-neutral-400">*</span>
          </legend>
          <div className="mt-2.5 flex gap-4">
            {['yes', 'no'].map((value) => (
              <label
                key={value}
                className={`flex items-center gap-2 text-sm capitalize ${i === 0 ? 'text-neutral-400' : 'text-neutral-900'}`}
              >
                <input
                  type="radio"
                  name={fieldId('recursive')}
                  value={value}
                  checked={entry.recursive === value}
                  onChange={() => onChange('recursive', value)}
                  className="size-4 accent-neutral-900"
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        {entry.recursive === 'yes' && (
          <>
            <div>
              {label('count', 'Count')}
              {numberInput('count', '5', 1)}
              {errorText('count')}
            </div>

            <div>
              {label('daysInterval', 'Days Interval')}
              {numberInput('daysInterval', '90', 1)}
              {errorText('daysInterval')}
            </div>

            <div>
              {label('kmInterval', 'Odometer Interval (km)')}
              {numberInput('kmInterval', '2500', 1)}
              {errorText('kmInterval')}
            </div>

            <fieldset className="sm:col-span-2 lg:col-span-5">
              <legend className="block text-sm font-medium text-neutral-700">
                Project from <span className="text-neutral-400">*</span>
              </legend>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                {baseOptions.map(({ value, label: text }) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-neutral-900">
                    <input
                      type="radio"
                      name={fieldId('base')}
                      value={value}
                      checked={entry.base === value}
                      onChange={() => onChange('base', value)}
                      className="size-4 accent-neutral-900"
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </div>
    </div>
  )
}

export default ServiceEntryCard
