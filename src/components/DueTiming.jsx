import { today } from '../lib/dates.js'
import { dueTiming } from '../lib/projection.js'

const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`

const styles = {
  upcoming: 'bg-neutral-100 text-neutral-700',
  due: 'bg-brand text-neutral-950',
  overdue: 'bg-red-600 text-white',
}

// Where today falls in a service's due window, by date: "Opens in 74 days", "Due now · 5 days left", "Past due date by 3 days".
function DueTiming({ service }) {
  const { state, days: n } = dueTiming(service, today())
  const text = {
    upcoming: `Opens in ${days(n)}`,
    due: n === 0 ? 'Due now · last day' : `Due now · ${days(n)} left`,
    overdue: `Past due date by ${days(n)}`,
  }[state]
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${styles[state]}`}>{text}</span>
}

export default DueTiming
