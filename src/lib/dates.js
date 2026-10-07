// Dates are stored as YYYY-MM-DD strings (same format as <input type="date">).

export const today = () => new Date().toLocaleDateString('en-CA')

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

export const formatDate = (value) =>
  new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export const daysBetween = (from, to) =>
  Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86_400_000)
