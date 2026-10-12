import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import DueTiming from '../components/DueTiming.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDate } from '../lib/dates.js'
import { formatKmRange, serviceLabel } from '../lib/projection.js'
import { loadServices, loadVehicles } from '../lib/storage.js'

const th = 'px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-neutral-500 first:pl-5'
const td = 'px-4 py-4 align-middle first:pl-5'

// The vehicle's open planned service (Pending or Ongoing), if one is projected.
const openServiceOf = (vehicle, services) =>
  services.find((s) => s.vehicleId === vehicle.id && (s.status === 'Pending' || s.status === 'Ongoing'))

function ProjectedVehicles() {
  const [vehicles] = useState(loadVehicles)
  const [services] = useState(loadServices)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projected Vehicles</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every onboarded vehicle and its next service, due at whichever comes first: KM or date.
          </p>
        </div>
        {vehicles.length > 0 && (
          <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-brand">
            {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}
          </span>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand text-neutral-950">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold">No vehicles onboarded yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Vehicles you onboard will show up here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-240 text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className={th}>Vehicle</th>
                  <th className={th}>Next Service</th>
                  <th className={th}>Due KM</th>
                  <th className={th}>Due Date</th>
                  <th className={th}>When</th>
                  <th className={th}>Invoice Date</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {vehicles.map((v) => {
                  const next = openServiceOf(v, services)
                  return (
                    <tr
                      key={v.id}
                      onClick={() => navigate(`/projected-vehicles/${v.regNo}`)}
                      className="group cursor-pointer transition-colors hover:bg-brand/10"
                    >
                      <td className={td}>
                        <Link
                          to={`/projected-vehicles/${v.regNo}`}
                          className="inline-block rounded-md border-2 border-neutral-900 bg-white px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand"
                        >
                          {v.regNo}
                        </Link>
                        <p className="mt-1.5 text-xs text-neutral-500">
                          {v.model} · {v.company}
                        </p>
                      </td>

                      <td className={td}>
                        {next ? (
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-bold text-brand">
                              {next.serviceNo}
                            </span>
                            <div className="min-w-0">
                              <p className="whitespace-nowrap font-semibold text-neutral-900">{serviceLabel(next.serviceNo)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="whitespace-nowrap rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-neutral-600">
                                  {next.serviceType}
                                </span>
                                <StatusBadge status={next.status} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500">No service projected</span>
                        )}
                      </td>

                      <td className={`${td} whitespace-nowrap font-semibold tabular-nums text-neutral-900`}>
                        {next ? formatKmRange(next) : <span className="font-normal text-neutral-400">—</span>}
                      </td>

                      <td className={`${td} whitespace-nowrap tabular-nums text-neutral-700`}>
                        {next ? (
                          <>
                            <p>{formatDate(next.dueDateFrom)}</p>
                            <p className="text-xs text-neutral-500">to {formatDate(next.dueDateTo)}</p>
                          </>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      <td className={td}>{next ? <DueTiming service={next} /> : <span className="text-neutral-400">—</span>}</td>

                      <td className={`${td} whitespace-nowrap tabular-nums text-neutral-700`}>
                        <p>{formatDate(v.invoiceDate)}</p>
                        <p className="text-xs text-neutral-500">Onboarded {formatDate(v.onboardedAt)}</p>
                      </td>

                      <td className="pr-4 text-neutral-400">
                        <svg
                          className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-900"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectedVehicles
