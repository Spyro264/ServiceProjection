import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { formatDate } from '../lib/dates.js'
import { formatDateRange, formatKmRange, serviceLabel, serviceTypeOf } from '../lib/projection.js'
import { loadVehicles } from '../lib/storage.js'

function ProjectedVehicles() {
  const [vehicles] = useState(loadVehicles)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Projected Vehicles</h1>
        <p className="mt-1 text-sm text-neutral-500">
          All onboarded vehicles and their next projected service. The service is due at whichever comes first, KM or
          date. Click a vehicle to see its service history.
        </p>
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
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Reg No</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Invoice Date</th>
                <th className="px-4 py-3">Onboarded On</th>
                <th className="px-4 py-3">Next Service</th>
                <th className="px-4 py-3">Due KM</th>
                <th className="px-4 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/projected-vehicles/${v.regNo}`)}
                  className="cursor-pointer whitespace-nowrap hover:bg-neutral-50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    <Link to={`/projected-vehicles/${v.regNo}`} className="underline-offset-2 hover:underline">
                      {v.regNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{v.model}</td>
                  <td className="px-4 py-3 text-neutral-700">{v.company}</td>
                  <td className="px-4 py-3 text-neutral-700">{formatDate(v.invoiceDate)}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(v.onboardedAt)}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {v.projection
                      ? `${serviceLabel(v.projection.serviceNo)} · ${v.projection.serviceType ?? serviceTypeOf(v.projection.serviceNo)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{v.projection ? formatKmRange(v.projection) : '—'}</td>
                  <td className="px-4 py-3 text-neutral-700">{v.projection ? formatDateRange(v.projection) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ProjectedVehicles
