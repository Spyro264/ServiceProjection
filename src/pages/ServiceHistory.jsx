import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router'
import { formatDate } from '../lib/dates.js'
import { FREE_SERVICES, formatDateRange, formatKmRange, lapseReason, serviceLabel } from '../lib/projection.js'
import { loadServices, loadUnplanned, loadVehicles } from '../lib/storage.js'
import { DECISIONS, criticalName, dueRange } from '../lib/unplanned.js'

// Completed = green, Late Done (work for a lapsed slot) = orange, Lapsed = red, Pending/Ongoing = brand yellow.
const statusStyles = {
  Pending: 'bg-brand text-neutral-950',
  Ongoing: 'bg-brand/40 text-neutral-950 ring-1 ring-brand',
  Completed: 'bg-green-600 text-white',
  'Late Done': 'bg-orange-500 text-white',
  Lapsed: 'bg-red-600 text-white',
  Recorded: 'bg-neutral-700 text-white',
  'No Data': 'border border-dashed border-neutral-300 text-neutral-500',
}

const displayStatus = (service) => (service.lateFor ? 'Late Done' : service.status)

const daysText = (days) => `${days} ${days === 1 ? 'day' : 'days'}`

const doneText = ({ kmDoneAt, doneDate }) =>
  kmDoneAt != null && doneDate ? `${kmDoneAt.toLocaleString('en-IN')} km · ${formatDate(doneDate)}` : null

const unplannedDue = (row) => (row.dueDateFrom ? row : dueRange(row))

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[status] ?? statusStyles.Pending}`}
    >
      {status}
    </span>
  )
}

function Tag({ children }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600">
      {children}
    </span>
  )
}

function ItemChips({ items }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            criticalName(item) ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-900">{value}</dd>
    </div>
  )
}

function Stat({ label, value, valueClass = 'text-neutral-900' }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function Chevron({ open }) {
  return (
    <svg
      className={`size-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

const th = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-neutral-500'
const td = 'px-4 py-3 align-top'
const none = <span className="text-neutral-400">—</span>

// A table whose rows open a details panel when clicked.
function HistoryTable({ columns, rows, renderCells, renderDetails, empty }) {
  const [openId, setOpenId] = useState(null)
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-600">
        {empty}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-180 text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr>
            {columns.map((c) => (
              <th key={c} className={th}>
                {c}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const details = renderDetails(row)
            const open = openId === row.id
            return (
              <Fragment key={row.id}>
                <tr
                  onClick={details ? () => setOpenId(open ? null : row.id) : undefined}
                  className={`border-b border-neutral-100 last:border-0 ${details ? 'cursor-pointer hover:bg-neutral-50' : ''} ${
                    open ? 'bg-neutral-50' : ''
                  }`}
                >
                  {renderCells(row)}
                  <td className={td}>{details && <Chevron open={open} />}</td>
                </tr>
                {open && (
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <td colSpan={columns.length + 1} className="px-4 pb-4">
                      {details}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PlannedDetails({ service }) {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Detail label="Service Center" value={service.serviceCenter} />
        <Detail label="Days Required" value={service.serviceDays && daysText(service.serviceDays)} />
        <Detail label="Service Items" value={service.items?.length > 0 && service.items.join(', ')} />
        <Detail label="Job Card" value={service.jobCardNo} />
      </dl>
      {service.status === 'Lapsed' && (
        <p className="text-xs font-medium text-red-700">
          Lapsed: done {lapseReason(service)}. The work was recorded as the {serviceLabel(service.serviceNo + 1)}.
        </p>
      )}
      {service.pulledForwardBy && (
        <p className="text-xs text-neutral-700">
          Done early on the same visit as unplanned request {service.pulledForwardBy}.
        </p>
      )}
      {service.basis && (
        <p className="text-xs text-neutral-600">
          <span className="font-medium text-neutral-700">
            {service.lateFor ? 'Late done: ' : service.status === 'Recorded' ? 'Note: ' : 'How it was projected: '}
          </span>
          {service.basis}
        </p>
      )}
    </div>
  )
}

function PlannedCells({ service: s }) {
  if (s.status === 'No Data') {
    return (
      <>
        <td className={`${td} text-neutral-400`}>{s.serviceNo}</td>
        <td className={`${td} text-neutral-500`}>
          {serviceLabel(s.serviceNo)} <span className="text-xs">· {s.serviceType}</span>
        </td>
        <td className={td}>
          <StatusBadge status="No Data" />
        </td>
        <td colSpan={2} className={`${td} text-neutral-400`}>
          Done before the vehicle was onboarded
        </td>
      </>
    )
  }
  return (
    <>
      <td className={`${td} font-semibold`}>{s.serviceNo}</td>
      <td className={td}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-neutral-900">{serviceLabel(s.serviceNo)}</span>
          <Tag>{s.serviceType}</Tag>
          {s.pulledForwardBy && <Tag>With {s.pulledForwardBy}</Tag>}
        </div>
      </td>
      <td className={td}>
        <StatusBadge status={displayStatus(s)} />
      </td>
      <td className={`${td} text-neutral-700`}>
        {s.kmFrom != null && !s.lateFor ? (
          <>
            <div>{formatKmRange(s)}</div>
            <div className="text-xs text-neutral-500">{formatDateRange(s)}</div>
          </>
        ) : (
          none
        )}
      </td>
      <td className={`${td} text-neutral-700`}>{doneText(s) ?? none}</td>
    </>
  )
}

function PlannedTab({ services }) {
  const count = (status) => services.filter((s) => displayStatus(s) === status).length
  const freeUsed = services.filter(
    (s) => s.serviceNo <= FREE_SERVICES && ['Completed', 'Lapsed', 'Recorded', 'No Data'].includes(s.status),
  ).length

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Completed on time" value={count('Completed')} valueClass="text-green-600" />
        <Stat label="Late Done" value={count('Late Done')} valueClass="text-orange-500" />
        <Stat label="Lapsed" value={count('Lapsed')} valueClass="text-red-600" />
        <Stat label="Free services used" value={`${freeUsed} / ${FREE_SERVICES}`} />
      </div>
      <HistoryTable
        columns={['#', 'Service', 'Status', 'Due', 'Done']}
        rows={services}
        empty="No planned services recorded for this vehicle yet."
        renderCells={(s) => <PlannedCells service={s} />}
        renderDetails={(s) => (s.status === 'No Data' ? null : <PlannedDetails service={s} />)}
      />
    </>
  )
}

const visitText = (row) =>
  row.decision === DECISIONS.pulledForward
    ? `With ${row.plannedJobCardNo} (planned pulled forward)`
    : row.decision === DECISIONS.pushed
      ? `With ${row.plannedJobCardNo} (pushed to planned)`
      : 'Own visit'

function UnplannedDetails({ row }) {
  const planned = row.plannedJobCardNo && `${serviceLabel(row.plannedServiceNo)} (${row.plannedJobCardNo})`
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Detail label="Raised On" value={formatDate(row.createdAt)} />
        <Detail label="Accepted On" value={row.acceptedAt && formatDate(row.acceptedAt)} />
        <Detail label="Service Center" value={row.serviceCenter} />
        <Detail label="Days Required" value={daysText(row.serviceDays)} />
      </dl>
      <p className="text-xs text-neutral-600">
        {row.decision === DECISIONS.pulledForward
          ? `Critical, and the planned ${planned} was near, so it was pulled forward and done on the same visit.`
          : row.decision === DECISIONS.pushed
            ? `Non-critical, and the planned ${planned} was near, so this work was pushed to that visit.`
            : 'No planned service was near (or it was already part of another visit), so this was done on its own.'}
      </p>
    </div>
  )
}

function UnplannedTab({ rows }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Requests" value={rows.length} />
        <Stat label="Critical" value={rows.filter((r) => r.critical).length} valueClass="text-red-600" />
        <Stat label="Open" value={rows.filter((r) => r.status !== 'Completed').length} />
        <Stat label="Completed" value={rows.filter((r) => r.status === 'Completed').length} valueClass="text-green-600" />
      </div>
      <HistoryTable
        columns={['Request', 'Things to Do', 'Status', 'Due', 'Done', 'Visit']}
        rows={rows}
        empty="No unplanned services for this vehicle yet."
        renderCells={(r) => (
          <>
            <td className={td}>
              <div className="whitespace-nowrap font-semibold text-neutral-900">{r.unplannedNo}</div>
              <div className="text-xs text-neutral-500">{r.critical ? 'Critical' : 'Non-critical'}</div>
            </td>
            <td className={td}>
              <ItemChips items={r.items} />
            </td>
            <td className={td}>
              <StatusBadge status={r.status} />
            </td>
            <td className={`${td} text-neutral-700`}>{formatDateRange(unplannedDue(r))}</td>
            <td className={`${td} text-neutral-700`}>{doneText(r) ?? none}</td>
            <td className={`${td} text-neutral-700`}>{visitText(r)}</td>
          </>
        )}
        renderDetails={(r) => <UnplannedDetails row={r} />}
      />
    </>
  )
}

function ServiceHistory() {
  const { regNo } = useParams()
  const [tab, setTab] = useState('Planned')
  const vehicle = loadVehicles().find((v) => v.regNo === regNo)
  const services = loadServices()
    .filter((s) => s.regNo === regNo)
    .sort((a, b) => a.serviceNo - b.serviceNo || (a.lateFor ? 1 : -1))
  const unplanned = loadUnplanned()
    .filter((r) => r.regNo === regNo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-6xl">
        <Link to="/projected-vehicles" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
          ← Projected Vehicles
        </Link>
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center text-sm text-neutral-600">
          Vehicle {regNo} was not found.
        </p>
      </div>
    )
  }

  const next = services.find((s) => s.status === 'Pending' || s.status === 'Ongoing')
  const openUnplanned = unplanned.filter((r) => r.status !== 'Completed')
  const tabs = [
    { name: 'Planned', count: services.length },
    { name: 'Unplanned', count: unplanned.length },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/projected-vehicles" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
        ← Projected Vehicles
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{vehicle.regNo}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {vehicle.model} · {vehicle.company} · Invoice date {formatDate(vehicle.invoiceDate)}
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-brand p-5 text-neutral-950">
          <p className="text-xs font-semibold uppercase tracking-wide">Next planned service</p>
          {next ? (
            <>
              <p className="mt-1 text-lg font-semibold">
                {serviceLabel(next.serviceNo)} · {next.serviceType} · {next.status}
              </p>
              <p className="mt-1 text-sm">
                {formatKmRange(next)} or {formatDateRange(next)}, whichever comes first
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm">None projected.</p>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Open unplanned requests</p>
          {openUnplanned.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {openUnplanned.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.unplannedNo}</span>
                  <StatusBadge status={r.status} />
                  <span className="text-neutral-600">due by {formatDate(unplannedDue(r).dueDateTo)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-neutral-600">None.</p>
          )}
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white p-1" role="tablist">
        {tabs.map(({ name, count }) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
              tab === name ? 'bg-brand text-neutral-950' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {name}<span className="hidden sm:inline"> Services</span> ({count})
          </button>
        ))}
      </div>

      {tab === 'Planned' ? <PlannedTab services={services} /> : <UnplannedTab rows={unplanned} />}
      <p className="mt-3 text-xs text-neutral-500">Click a row to see its details.</p>
    </div>
  )
}

export default ServiceHistory
