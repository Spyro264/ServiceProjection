import { entryDetail, ruleSummary, ruleTitle, scheduleOf, slotLabels } from '../lib/projection.js'

const num = (value) => Number(value).toLocaleString('en-IN')

// Read-only summary of the service rule being set up, kept in view while the tag is picked.
function RulePlanCard({ rule, tagName, bikeCount }) {
  const schedule = scheduleOf(rule)
  const labels = slotLabels(schedule)

  return (
    <div className="overflow-hidden rounded-xl bg-neutral-950 text-neutral-300 shadow-sm">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Service Rule</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{ruleTitle(rule)}</h2>
        {rule.name && <p className="mt-1 text-xs text-neutral-500">{ruleSummary(rule)}</p>}
      </div>

      <ol className="relative space-y-4 p-5">
        <span className="absolute top-10 bottom-10 left-8 w-px -translate-x-1/2 bg-white/15" aria-hidden="true" />
        {schedule.map((entry, i) => (
          <li key={i} className="relative flex items-center gap-3">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold ${
                entry.base !== 'invoice' ? 'bg-brand text-neutral-950' : 'border border-white/20 bg-neutral-950 text-white'
              }`}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">
                {labels[i]} <span className="ml-1 text-xs font-normal text-neutral-500">{entry.type}</span>
              </p>
              <p className="text-xs text-neutral-500">{entryDetail(entry)}</p>
            </div>
            <p className="text-right text-sm tabular-nums">
              {entry.base !== 'invoice' && '+'}
              {num(entry.kmMin)}–{num(entry.kmMax)} km
              <span className="block text-xs text-neutral-500">
                {entry.base !== 'invoice' && '+'}
                {num(entry.daysMin)}–{num(entry.daysMax)} days
              </span>
            </p>
          </li>
        ))}
      </ol>

      {tagName !== undefined && (
        <div className="space-y-3 border-t border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Tag</span>
            <span className="truncate rounded-md bg-brand/15 px-2 py-0.5 text-sm font-medium text-brand">{tagName}</span>
          </div>
          {bikeCount !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Bikes</span>
              <span className="text-sm font-medium tabular-nums text-white">{bikeCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RulePlanCard
