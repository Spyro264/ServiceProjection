import { windowOf } from './projection.js'

// Form state and checks for the services of a service rule, shared by Service Plan Setup and the edit on Service Plans.

// Example values: the 1st service within 30 days / 1,000 km of the invoice date with a ±5 day and ±200 km buffer,
// later ones 60 days / 4,000 km after the previous service with a ±15 day and ±500 km buffer.
export const invoiceExample = { days: 30, km: 1000, daysLower: 5, daysUpper: 5, kmLower: 200, kmUpper: 200 }
export const previousExample = { days: 60, km: 4000, daysLower: 15, daysUpper: 15, kmLower: 500, kmUpper: 500 }

export const idealFields = [
  { name: 'days', label: 'Service Due After (Days)' },
  { name: 'km', label: 'Service Due After (km)' },
]

// The 1st service is always within 30 days of the invoice date.
const FIRST_SERVICE_DAYS = '30'
export const daysLabel = (i) => (i === 0 ? 'Service Within (Days)' : 'Service Due After (Days)')

// Lower limit is taken off the ideal value, upper limit is added to it.
export const bufferGroups = [
  {
    title: 'Buffer Duration',
    fields: [
      { name: 'daysLower', label: 'Lower Limit (Days)' },
      { name: 'daysUpper', label: 'Upper Limit (Days)' },
    ],
  },
  {
    title: 'Buffer Odometer Reading',
    fields: [
      { name: 'kmLower', label: 'Lower Limit (km)' },
      { name: 'kmUpper', label: 'Upper Limit (km)' },
    ],
  },
]

const bufferFields = bufferGroups.flatMap((group) => group.fields)

const numberFields = [...idealFields, ...bufferFields]

// What the repeats of a recursive service are counted from. The service itself (like every service) is a fixed point
// counted from the invoice date.
export const baseOptions = [
  { value: 'actual', label: 'Previous service (actual odo / date)' },
  { value: 'projected', label: 'Previous projected service' },
]

// One service in the form. Values are strings while editing. Every service's days / km are counted from the invoice date;
// the 1st is always Free. `base` is only used by the repeats of a recursive service.
export const newEntry = (type, base) => ({
  key: crypto.randomUUID(),
  type,
  days: '',
  km: '',
  daysLower: '',
  daysUpper: '',
  kmLower: '',
  kmUpper: '',
  base,
  recursive: 'no',
  count: '',
  daysInterval: '',
  kmInterval: '',
})

export const emptySchedule = () => [{ ...newEntry('Free', 'invoice'), days: FIRST_SERVICE_DAYS }]

export const errorKey = (entry, field) => `${entry.key}.${field}`

const isNumberAtLeast = (value, min) => value.trim() !== '' && Number(value) >= min

export function validateSchedule(schedule) {
  const errors = {}
  schedule.forEach((entry, i) => {
    const fail = (field, text) => {
      errors[errorKey(entry, field)] = text
    }
    if (!entry.type.trim()) fail('type', 'Required')
    for (const { name: field } of idealFields) {
      if (!entry[field].trim()) fail(field, 'Required')
      else if (!isNumberAtLeast(entry[field], 1)) fail(field, 'Must be a number above 0')
    }
    for (const { name: field } of bufferFields) {
      if (!entry[field].trim()) fail(field, 'Required')
      else if (!isNumberAtLeast(entry[field], 0)) fail(field, 'Must be 0 or more')
    }
    // Services are fixed points from the invoice date, so each one must come after the one before it.
    const previous = schedule[i - 1]
    for (const [field, text] of [
      ['days', 'days'],
      ['km', 'km'],
    ]) {
      if (previous && !errors[errorKey(entry, field)] && isNumberAtLeast(previous[field], 1) && Number(entry[field]) <= Number(previous[field])) {
        fail(field, `Must be more than the previous service (${Number(previous[field]).toLocaleString('en-IN')} ${text})`)
      }
    }
    // The window cannot start below 0.
    for (const [lower, ideal, label] of [
      ['daysLower', 'days', daysLabel(i).replace(' (Days)', '')],
      ['kmLower', 'km', 'Service Due After'],
    ]) {
      if (!errors[errorKey(entry, lower)] && !errors[errorKey(entry, ideal)] && Number(entry[lower]) > Number(entry[ideal])) {
        fail(lower, `Cannot be more than ${label}`)
      }
    }
    if (entry.base !== 'invoice' && entry.recursive === 'yes') {
      const count = Number(entry.count)
      if (!entry.count.trim() || !Number.isInteger(count) || count < 1) fail('count', 'Enter a whole number, 1 or more')
      // Each repeat's window cannot start before the previous service either.
      for (const [field, lower, text] of [
        ['daysInterval', 'daysLower', 'Lower Limit (Days)'],
        ['kmInterval', 'kmLower', 'Lower Limit (km)'],
      ]) {
        if (!entry[field].trim()) fail(field, 'Required')
        else if (!isNumberAtLeast(entry[field], 1)) fail(field, 'Must be a number above 0')
        else if (!errors[errorKey(entry, lower)] && Number(entry[lower]) > Number(entry[field])) {
          fail(field, `Cannot be less than ${text}`)
        }
      }
    }
  })
  return errors
}

// Rule schedule from the form; serviceNo is the service's position (1, 2, 3 ...).
// Values are read leniently so the service labels can update while typing.
export function scheduleFromForm(schedule) {
  return schedule.map((entry, i) => {
    const { type, base, recursive, count, daysInterval, kmInterval } = entry
    const repeats = base !== 'invoice' && recursive === 'yes'
    return {
      serviceNo: i + 1,
      type: type.trim(),
      ...Object.fromEntries(numberFields.map(({ name }) => [name, Number(entry[name])])),
      base: base === 'invoice' || repeats ? base : 'actual',
      recursive: repeats,
      // A recursive service is its own service plus `count` repeats.
      count: repeats ? Math.max(1, Math.floor(Number(count)) || 1) : 0,
      ...(repeats && { daysInterval: Number(daysInterval), kmInterval: Number(kmInterval) }),
    }
  })
}

const num = (value) => value.toLocaleString('en-IN')

// e.g. "Due 15–45 days and 500–1,500 km after the invoice date." once all the numbers are filled in.
export function dueText(entry, i) {
  const after = 'the invoice date'
  if (!numberFields.every(({ name }) => isNumberAtLeast(entry[name], 0))) {
    return `Days and km are counted from ${after}.`
  }
  const values = Object.fromEntries(numberFields.map(({ name }) => [name, Number(entry[name])]))
  const { daysMin, daysMax, kmMin, kmMax } = windowOf(values)
  const due = `Due ${num(daysMin)}–${num(daysMax)} days and ${num(kmMin)}–${num(kmMax)} km after ${after}.`
  const count = Number(entry.count)
  if (i === 0 || entry.recursive !== 'yes' || !(count >= 1) || !isNumberAtLeast(entry.daysInterval, 1) || !isNumberAtLeast(entry.kmInterval, 1)) {
    return due
  }
  const repeat = windowOf({ ...values, days: Number(entry.daysInterval), km: Number(entry.kmInterval) })
  const from = entry.base === 'projected' ? "previous projected service's ideal point" : 'previous service'
  return `${due} Then ${num(count)} repeat${count === 1 ? '' : 's'}, each ${num(repeat.daysMin)}–${num(repeat.daysMax)} days and ${num(repeat.kmMin)}–${num(repeat.kmMax)} km after the ${from}.`
}

// A saved service as form values (strings while editing), so it can be edited with the same form.
export const entryToForm = (entry) => ({
  key: crypto.randomUUID(),
  type: entry.type,
  ...Object.fromEntries(numberFields.map(({ name }) => [name, String(entry[name] ?? '')])),
  base: entry.base,
  recursive: entry.recursive ? 'yes' : 'no',
  count: entry.recursive ? String(entry.count) : '',
  daysInterval: String(entry.daysInterval ?? ''),
  kmInterval: String(entry.kmInterval ?? ''),
})
