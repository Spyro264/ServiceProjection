import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router'
import DueTiming from '../components/DueTiming.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDate } from '../lib/dates.js'
import { formatDateRange, formatKmRange, freeCountOf, lapseReason, ruleTitle, serviceLabel } from '../lib/projection.js'
import { currentRule, tagRuleFor } from '../lib/services.js'
import { loadServices, loadUnplanned, loadVehicles } from '../lib/storage.js'
import { DECISIONS, criticalName, dueRange } from '../lib/unplanned.js'

// Number circle colours, matching the status badges.
const circleStyles = {
  Pending: 'bg-brand text-neutral-950',
  Ongoing: 'bg-neutral-950 text-brand',
  Completed: 'bg-green-600 text-white',
  Lapsed: 'bg-red-600 text-white',
  Recorded: 'bg-neutral-700 text-white',
  'No Data': 'border border-dashed border-neutral-300 bg-white text-neutral-400',
}

const daysText = (days) => `${days} ${days === 1 ? 'day' : 'days'}`

const doneText = ({ kmDoneAt, doneDate }) =>
  kmDoneAt != null && doneDate ? `${kmDoneAt.toLocaleString('en-IN')} km · ${formatDate(doneDate)}` : null

const unplannedDue = (row) => (row.dueDateFrom ? row : dueRange(row))

const eyebrow = 'text-[0.6875rem] font-semibold uppercase tracking-wider'

function TypeChip({ children }) {
  return (
    <span className="whitespace-nowrap rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-neutral-600">
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
      <dt className={`${eyebrow} text-neutral-500`}>{label}</dt>
      <dd className="mt-1 text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  )
}

function Stat({ label, value, dot }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-medium text-neutral-500">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  )
}

// A coloured note in a details panel.
function Callout({ tone = 'neutral', label, children }) {
  const tones = {
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
    red: 'border-red-200 bg-red-50 text-red-800',
  }
  return (
    <p className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${tones[tone]}`}>
      {label && <span className="font-semibold">{label} </span>}
      {children}
    </p>
  )
}

function Chevron({ open }) {
  return (
    <svg
      className={`size-4 transition-transform ${open ? 'rotate-180 text-neutral-900' : 'text-neutral-400'}`}
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

const th = 'px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-neutral-500 first:pl-5'
const td = 'px-4 py-4 align-middle first:pl-5'
const none = <span className="text-neutral-400">—</span>

// A table whose rows open a details panel when clicked. rowClass(row) adds a row tint.
function HistoryTable({ columns, rows, renderCells, renderDetails, rowClass = () => '', empty }) {
  const [openId, setOpenId] = useState(null)
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-600">
        {empty}
      </p>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
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
                    className={`border-b border-neutral-100 transition-colors last:border-0 ${open ? 'bg-brand/10' : rowClass(row)} ${
                      details ? 'cursor-pointer hover:bg-brand/10' : ''
                    }`}
                  >
                    {renderCells(row)}
                    <td className="pr-4">{details && <Chevron open={open} />}</td>
                  </tr>
                  {open && (
                    <tr className="border-b border-neutral-100 bg-brand/10">
                      <td colSpan={columns.length + 1} className="px-5 pb-5">
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
    </div>
  )
}

// Where the late work for a lapsed service went. Rows saved before late work could pass several slots have no
// lateServiceNo: their work took the next slot.
const lateText = ({ lateServiceNo, serviceNo }) =>
  lateServiceNo === null
    ? 'The rule had no later service left for the work.'
    : `The work was recorded as the ${serviceLabel(lateServiceNo ?? serviceNo + 1)}.`

function PlannedDetails({ service }) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Detail label="Service Center" value={service.serviceCenter} />
        <Detail label="Days Required" value={service.serviceDays && daysText(service.serviceDays)} />
        <Detail label="Job Card" value={service.jobCardNo} />
        <Detail label="Done" value={doneText(service)} />
      </dl>
      {service.items?.length > 0 && (
        <div>
          <p className={`${eyebrow} mb-1.5 text-neutral-500`}>Service Items</p>
          <ItemChips items={service.items} />
        </div>
      )}
      {service.status === 'Lapsed' && (
        <Callout tone="red" label="Lapsed:">
          {service.lapsedWith
            ? `not done. The late work for the ${serviceLabel(service.lapsedWith)} was ${lapseReason(service)}.`
            : `done ${lapseReason(service)}.`}{' '}
          {lateText(service)}
        </Callout>
      )}
      {service.pulledForwardBy && <Callout>Done early on the same visit as unplanned request {service.pulledForwardBy}.</Callout>}
      {service.basis && (
        <Callout label={service.lateFor ? 'Late work:' : service.status === 'Recorded' ? 'Note:' : 'How it was projected:'}>
          {service.basis}
        </Callout>
      )}
    </div>
  )
}

// What happened to the service: when it was done, why it was missed, or how long until it is due.
function DoneCell({ service: s }) {
  if (s.status === 'Pending' || s.status === 'Ongoing') return s.dueDateTo ? <DueTiming service={s} /> : none
  if (s.status === 'Lapsed') {
    return (
      <>
        <p className="font-semibold text-red-700">Missed</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {s.lapsedWith
            ? `Late work for the ${serviceLabel(s.lapsedWith)} went past it`
            : `Done late at ${doneText(s)}${s.lateServiceNo ? `, counted as ${serviceLabel(s.lateServiceNo)}` : ''}`}
        </p>
      </>
    )
  }
  return (
    <>
      <p className="tabular-nums text-neutral-900">{doneText(s) ?? none}</p>
      {s.lateFor && <p className="mt-0.5 text-xs text-neutral-500">Late work for the {serviceLabel(s.lateFor)}</p>}
    </>
  )
}

function PlannedCells({ service: s }) {
  const circle = (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${circleStyles[s.status] ?? circleStyles.Pending}`}
    >
      {s.serviceNo}
    </span>
  )
  if (s.status === 'No Data') {
    return (
      <>
        <td className={td}>
          <div className="flex items-center gap-3">
            {circle}
            <span className="text-neutral-500">{serviceLabel(s.serviceNo)}</span>
          </div>
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
      <td className={td}>
        <div className="flex items-center gap-3">
          {circle}
          <div className="min-w-0">
            <p className="whitespace-nowrap font-semibold text-neutral-900">{serviceLabel(s.serviceNo)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TypeChip>{s.serviceType}</TypeChip>
              {s.pulledForwardBy && <TypeChip>With {s.pulledForwardBy}</TypeChip>}
            </div>
          </div>
        </div>
      </td>
      <td className={td}>
        <StatusBadge status={s.status} />
      </td>
      <td className={`${td} whitespace-nowrap tabular-nums`}>
        {s.kmFrom != null ? (
          <>
            <p className="font-medium text-neutral-900">{formatKmRange(s)}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{formatDateRange(s)}</p>
          </>
        ) : (
          none
        )}
      </td>
      <td className={td}>
        <DoneCell service={s} />
      </td>
    </>
  )
}

function PlannedTab({ services, freeCount }) {
  const count = (status) => services.filter((s) => s.status === status).length
  const freeUsed = services.filter(
    (s) => s.serviceNo <= freeCount && ['Completed', 'Lapsed', 'Recorded', 'No Data'].includes(s.status),
  ).length

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Completed" value={count('Completed')} dot="bg-green-600" />
        <Stat label="Lapsed" value={count('Lapsed')} dot="bg-red-600" />
        <Stat label="Free services used" value={freeCount ? `${freeUsed} / ${freeCount}` : '—'} dot="bg-brand" />
      </div>
      <HistoryTable
        columns={['Service', 'Status', 'Due', 'Done']}
        rows={services}
        empty="No planned services recorded for this vehicle yet."
        renderCells={(s) => <PlannedCells service={s} />}
        renderDetails={(s) => (s.status === 'No Data' ? null : <PlannedDetails service={s} />)}
        rowClass={(s) => (s.status === 'Lapsed' ? 'bg-red-50/50' : '')}
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
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Detail label="Raised On" value={formatDate(row.createdAt)} />
        <Detail label="Accepted On" value={row.acceptedAt && formatDate(row.acceptedAt)} />
        <Detail label="Service Center" value={row.serviceCenter} />
        <Detail label="Days Required" value={daysText(row.serviceDays)} />
      </dl>
      <Callout>
        {row.decision === DECISIONS.pulledForward
          ? `Critical, and the planned ${planned} was near, so it was pulled forward and done on the same visit.`
          : row.decision === DECISIONS.pushed
            ? `Non-critical, and the planned ${planned} was near, so this work was pushed to that visit.`
            : 'No planned service was near (or it was already part of another visit), so this was done on its own.'}
      </Callout>
    </div>
  )
}

function UnplannedTab({ rows }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Requests" value={rows.length} dot="bg-neutral-900" />
        <Stat label="Critical" value={rows.filter((r) => r.critical).length} dot="bg-red-600" />
        <Stat label="Open" value={rows.filter((r) => r.status !== 'Completed').length} dot="bg-brand" />
        <Stat label="Completed" value={rows.filter((r) => r.status === 'Completed').length} dot="bg-green-600" />
      </div>
      <HistoryTable
        columns={['Request', 'Things to Do', 'Status', 'Due', 'Done', 'Visit']}
        rows={rows}
        empty="No unplanned services for this vehicle yet."
        renderCells={(r) => (
          <>
            <td className={td}>
              <p className="whitespace-nowrap font-semibold text-neutral-900">{r.unplannedNo}</p>
              <p className={`mt-0.5 text-xs ${r.critical ? 'font-medium text-red-700' : 'text-neutral-500'}`}>
                {r.critical ? 'Critical' : 'Non-critical'}
              </p>
            </td>
            <td className={td}>
              <ItemChips items={r.items} />
            </td>
            <td className={td}>
              <StatusBadge status={r.status} />
            </td>
            <td className={`${td} whitespace-nowrap tabular-nums text-neutral-700`}>{formatDateRange(unplannedDue(r))}</td>
            <td className={`${td} tabular-nums text-neutral-700`}>{doneText(r) ?? none}</td>
            <td className={`${td} text-neutral-700`}>{visitText(r)}</td>
          </>
        )}
        renderDetails={(r) => <UnplannedDetails row={r} />}
      />
    </>
  )
}

function BackLink() {
  return (
    <Link
      to="/projected-vehicles"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
    >
      <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
      Projected Vehicles
    </Link>
  )
}

function NextServiceCard({ next }) {
  return (
    <div className="rounded-xl bg-brand p-5 text-neutral-950 shadow-sm lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <p className={eyebrow}>Next planned service</p>
        {/* Dark badge: the yellow status badge would not show on the yellow card. */}
        {next && (
          <span className="whitespace-nowrap rounded-full bg-neutral-950 px-2.5 py-0.5 text-xs font-semibold text-brand">{next.status}</span>
        )}
      </div>
      {next ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-base font-bold text-brand">
              {next.serviceNo}
            </span>
            <div>
              <p className="text-xl font-semibold leading-tight">{serviceLabel(next.serviceNo)}</p>
              <p className="text-sm text-neutral-800">{next.serviceType}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/80 p-3">
              <p className={`${eyebrow} text-neutral-500`}>Due KM</p>
              <p className="mt-1 font-semibold tabular-nums">{formatKmRange(next)}</p>
            </div>
            <div className="rounded-lg bg-white/80 p-3">
              <p className={`${eyebrow} text-neutral-500`}>Due Date</p>
              <p className="mt-1 font-semibold tabular-nums">{formatDateRange(next)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-800">
            <span>Due at whichever comes first.</span>
            <span className="rounded-md bg-white p-0.5">
              <DueTiming service={next} />
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm">None projected.</p>
      )}
    </div>
  )
}

function OpenUnplannedCard({ rows }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className={`${eyebrow} text-neutral-500`}>Open unplanned requests</p>
      {rows.length > 0 ? (
        <ul className="mt-3 divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 py-2 first:pt-0">
              <span className="font-semibold">{r.unplannedNo}</span>
              <StatusBadge status={r.status} />
              <span className="w-full text-xs text-neutral-500">Due by {formatDate(unplannedDue(r).dueDateTo)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
          <span className="flex size-6 items-center justify-center rounded-full bg-green-50 text-green-700">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </span>
          No open requests.
        </div>
      )}
    </div>
  )
}

function ServiceHistory() {
  const { regNo } = useParams()
  const [tab, setTab] = useState('Planned')
  const vehicle = loadVehicles().find((v) => v.regNo === regNo)
  const rule = vehicle && currentRule(vehicle)
  const services = loadServices()
    .filter((s) => s.regNo === regNo)
    .sort((a, b) => a.serviceNo - b.serviceNo || (a.lateFor ? 1 : -1))
  const unplanned = loadUnplanned()
    .filter((r) => r.regNo === regNo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-6xl">
        <BackLink />
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center text-sm text-neutral-600">
          Vehicle {regNo} was not found.
        </p>
      </div>
    )
  }

  const { tag } = tagRuleFor(vehicle.regNo)
  const next = services.find((s) => s.status === 'Pending' || s.status === 'Ongoing')
  const openUnplanned = unplanned.filter((r) => r.status !== 'Completed')
  const tabs = [
    { name: 'Planned', count: services.length },
    { name: 'Unplanned', count: unplanned.length },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink />

      <div className="mt-4 mb-6">
        <h1 className="inline-block rounded-lg border-2 border-neutral-900 bg-white px-3 py-1 font-mono text-2xl font-bold tracking-wider text-neutral-950">
          {vehicle.regNo}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">{vehicle.model}</span>
          <span className="text-neutral-300">·</span>
          <span>{vehicle.company}</span>
          <span className="text-neutral-300">·</span>
          <span>Invoice date {formatDate(vehicle.invoiceDate)}</span>
          {rule && (
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-neutral-950 px-2 py-0.5 text-xs font-semibold text-brand">
              {tag && (
                <>
                  <span>{tag.name}</span>
                  <span className="text-neutral-500">·</span>
                </>
              )}
              <span>{ruleTitle(rule)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <NextServiceCard next={next} />
        <OpenUnplannedCard rows={openUnplanned} />
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white p-1 shadow-sm" role="tablist">
        {tabs.map(({ name, count }) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
              tab === name ? 'bg-brand text-neutral-950' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <span>
              {name}
              <span className="hidden sm:inline"> Services</span>
            </span>
            <span
              className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                tab === name ? 'bg-neutral-950 text-brand' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'Planned' ? <PlannedTab services={services} freeCount={rule ? freeCountOf(rule) : 0} /> : <UnplannedTab rows={unplanned} />}
      <p className="mt-3 text-xs text-neutral-500">Click a row to see its details.</p>
    </div>
  )
}

export default ServiceHistory
