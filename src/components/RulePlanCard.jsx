import { freeServicesOf, serviceLabel } from '../lib/projection.js'

const num = (value) => Number(value).toLocaleString('en-IN')

// Read-only summary of the service rule being set up, kept in view while the tag and vehicles are picked.
function RulePlanCard({ rule, tagName, bikeCount }) {
  return (
    <div className="overflow-hidden rounded-xl bg-neutral-950 text-neutral-300 shadow-sm">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Service Rule</p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          {freeServicesOf(rule).length} free service{freeServicesOf(rule).length === 1 ? '' : 's'}, then PMS
        </h2>
      </div>

      <ol className="relative space-y-4 p-5">
        <span className="absolute top-10 bottom-10 left-8 w-px -translate-x-1/2 bg-white/15" aria-hidden="true" />
        {freeServicesOf(rule).map(({ km, days }, i) => (
          <li key={i} className="relative flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-neutral-950 text-[0.625rem] font-semibold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">
                {serviceLabel(i + 1)} <span className="ml-1 text-xs font-normal text-neutral-500">Free</span>
              </p>
            </div>
            <p className="text-right text-sm tabular-nums">
              {num(km)} km
              <span className="block text-xs text-neutral-500">{num(days)} days</span>
            </p>
          </li>
        ))}
        <li className="relative flex items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-neutral-950">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">
              Then every <span className="ml-1 text-xs font-normal text-neutral-500">PMS</span>
            </p>
          </div>
          <p className="text-right text-sm tabular-nums">
            {num(rule.recursiveKm)} km
            <span className="block text-xs text-neutral-500">{num(rule.recursiveDays)} days</span>
          </p>
        </li>
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs">
        <span className="text-neutral-500">Grace window</span>
        <span className="tabular-nums text-neutral-300">
          +{num(rule.kmLimit)} km · +{num(rule.dayLimit)} days
        </span>
      </div>

      {tagName !== undefined && (
        <div className="space-y-3 border-t border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Tag</span>
            <span className="truncate rounded-md bg-brand/15 px-2 py-0.5 text-sm font-medium text-brand">{tagName}</span>
          </div>
          {bikeCount !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Bikes</span>
              <span className="text-sm font-medium tabular-nums text-white">{bikeCount} selected</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RulePlanCard
