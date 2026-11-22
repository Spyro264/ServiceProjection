// Completed/Done/Approved = green, Lapsed = red, Delayed Completion = orange, Pending/Ongoing/In Progress = brand yellow, Recorded/Submitted = grey, Draft/No Data = outline.
const styles = {
  Pending: { badge: 'bg-brand/25 text-neutral-900 ring-brand', dot: 'bg-amber-500' },
  Ongoing: { badge: 'bg-brand text-neutral-950 ring-brand', dot: 'bg-neutral-950' },
  Completed: { badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600' },
  Lapsed: { badge: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-600' },
  Recorded: { badge: 'bg-neutral-100 text-neutral-800 ring-neutral-300', dot: 'bg-neutral-700' },
  Draft: { badge: 'bg-white text-neutral-500 ring-neutral-300', dot: 'bg-neutral-300' },
  Approved: { badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600' },
  'In Progress': { badge: 'bg-brand text-neutral-950 ring-brand', dot: 'bg-neutral-950' },
  Submitted: { badge: 'bg-neutral-100 text-neutral-800 ring-neutral-300', dot: 'bg-neutral-700' },
  Done: { badge: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600' },
  'Delayed Completion': { badge: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
  'No Data': { badge: 'bg-white text-neutral-500 ring-neutral-300', dot: 'bg-neutral-300' },
}

function StatusBadge({ status }) {
  const style = styles[status] ?? styles.Pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {status}
    </span>
  )
}

export default StatusBadge
