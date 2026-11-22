import { useState } from 'react'
import { logTable } from '../lib/log.js'
import { INTERVAL_KM, NEXT_BUFFER_KM, PROJECTION_BASES } from '../lib/demoProjection.js'
import { PLANS, SERVICE_COUNT, dryRun, offsetLimits, stress } from '../lib/partsPlanDryRun.js'

// Service Parts Demo: dry run of the two spare parts plans on the same 35-service projection.
// Left = range-wise (parts by the odo range the projected due falls in), right = static (parts by service number).

const inputClass = (error) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 ${
    error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
  }`

const primaryButton =
  'rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-neutral-950 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2'

const fields = [
  { name: 'due', label: 'Due Point (km)', placeholder: '750' },
  { name: 'lowerBuffer', label: 'Lower Buffer (km)', placeholder: '250' },
  { name: 'upperBuffer', label: 'Upper Buffer (km)', placeholder: '250' },
  { name: 'offset', label: 'Completed At (km after due)', placeholder: '300' },
]

const emptyForm = { due: '', lowerBuffer: '', upperBuffer: '', offset: '', basis: 'prev_odo' }

const km = (value) => (value == null ? '—' : value.toLocaleString('en-IN'))
const signedKm = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${km(Math.abs(value))}`

function validate(form) {
  const errors = {}
  const num = (name) => Number(form[name])
  const filled = (name) => form[name].trim() !== ''

  for (const name of ['due', 'lowerBuffer', 'upperBuffer']) {
    if (!filled(name)) errors[name] = 'Required'
    else if (!Number.isInteger(num(name)) || num(name) < 0) errors[name] = 'Enter a whole number of km'
  }
  if (!errors.due && num('due') <= 0) errors.due = 'Must be more than 0'
  if (!errors.due && !errors.lowerBuffer && num('lowerBuffer') > num('due')) errors.lowerBuffer = 'Cannot be more than the due point'

  if (!filled('offset')) errors.offset = 'Required'
  else if (!Number.isInteger(num('offset'))) errors.offset = 'Enter a whole number of km (negative = early)'
  else if (!errors.lowerBuffer) {
    const { min, max } = offsetLimits(num('lowerBuffer'))
    if (num('offset') < min) errors.offset = `Before the window start (min ${signedKm(min)})`
    else if (num('offset') > max) errors.offset = `In the next service's window (max ${signedKm(max)})`
  }
  return errors
}

const tones = {
  range: { box: 'border-blue-200', head: 'border-blue-200 bg-blue-50 text-blue-900', dot: 'bg-blue-500', thead: 'bg-blue-50/60 text-blue-900/70' },
  static: { box: 'border-teal-200', head: 'border-teal-200 bg-teal-50 text-teal-900', dot: 'bg-teal-500', thead: 'bg-teal-50/60 text-teal-900/70' },
}

// Parts the job card got: green = its own service's parts, amber = another service's, red = none.
function PartsCell({ card }) {
  if (card.parts_from == null) return <span className="font-medium text-red-700">None</span>
  const own = card.parts_from === card.service_no
  return (
    <span className={own ? 'text-green-700' : 'font-medium text-amber-700'}>
      {card.parts.length} · S{card.parts_from}
    </span>
  )
}

function DoneAt({ card }) {
  return (
    <>
      {km(card.completed_at)}
      {card.work_done_status === 'delayed_completion' && <span className="ml-1 text-xs text-neutral-400">late</span>}
    </>
  )
}

function Stat({ label, value, alert }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${alert ? 'text-red-700' : 'text-neutral-900'}`}>{km(value)}</dd>
    </div>
  )
}

function PlanColumn({ tone, title, subtitle, run, columns, footer }) {
  const s = run.summary
  return (
    <section className={`overflow-hidden rounded-xl border bg-white ${tone.box}`}>
      <div className={`border-b px-4 py-3 ${tone.head}`}>
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${tone.dot}`} aria-hidden="true" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <p className="mt-0.5 text-xs opacity-80">{subtitle}</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 border-b border-neutral-100 px-4 py-3">
        <Stat label="Parts missed" value={s.parts_missed} alert={s.parts_missed > 0} />
        <Stat label="Parts given" value={s.parts_given} />
        <Stat label="Job cards with no parts" value={s.cards_without_parts} alert={s.cards_without_parts > 0} />
      </dl>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className={`text-left text-xs font-semibold uppercase tracking-wide ${tone.thead}`}>
            <tr>
              {columns.map((c) => (
                <th key={c.label} className="px-3 py-2.5">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {run.cards.map((card) => (
              <tr key={card.service_no} className={card.parts_from == null ? 'bg-red-50/60' : undefined}>
                {columns.map((c) => (
                  <td key={c.label} className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-900">
                    {c.cell(card)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  )
}

const svcColumn = { label: 'Service', cell: (c) => c.service_no }
const dueColumn = { label: 'Projected Due', cell: (c) => km(c.due) }
const doneColumn = { label: 'Done At', cell: (c) => <DoneAt card={c} /> }
const partsColumn = { label: 'Parts Given', cell: (c) => <PartsCell card={c} /> }

const rangeColumns = [
  svcColumn,
  dueColumn,
  { label: 'Service Range', cell: (c) => `${km(c.lower_buffer_km)} – ${km(c.upper_buffer_km)}` },
  { label: 'Parts Range', cell: (c) => `${km(c.own_range.from)} – ${km(c.own_range.to)}` },
  { label: 'Range Parts', cell: (c) => `${c.own_range.parts_count} ${c.own_range.parts_count === 1 ? 'part' : 'parts'}` },
  partsColumn,
  doneColumn,
]
const staticColumns = [svcColumn, dueColumn, partsColumn, doneColumn]

// Ranges the bike went past without a job card landing in them.
function MissedRanges({ ranges }) {
  const missed = ranges.filter((r) => r.state === 'missed')
  const notReached = ranges.filter((r) => r.state === 'not_reached')
  if (missed.length === 0 && notReached.length === 0) return null
  return (
    <div className="space-y-2 border-t border-neutral-200 px-4 py-3">
      {missed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-700">Ranges skipped — parts never given ({missed.length})</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {missed.map((r) => (
              <li key={r.service_no} className="rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-800 ring-1 ring-inset ring-red-200">
                S{r.service_no} · {km(r.from)}–{km(r.to)} · {r.parts_count} parts
              </li>
            ))}
          </ul>
        </div>
      )}
      {notReached.length > 0 && (
        <p className="text-xs text-neutral-500">
          Not reached yet after {SERVICE_COUNT} services (not counted as missed): {notReached.map((r) => `S${r.service_no}`).join(', ')}
        </p>
      )}
    </div>
  )
}

function Verdict({ result }) {
  const range = result.rangeWise.summary.parts_missed
  const stat = result.static.summary.parts_missed
  const headline =
    range === stat
      ? `Both plans miss ${km(range)} parts for this input.`
      : range > stat
        ? `Range-wise misses ${km(range)} parts, static misses ${km(stat)} — static is the safer plan.`
        : `Static misses ${km(stat)} parts, range-wise misses ${km(range)} — range-wise is the safer plan.`
  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
      <h2 className="text-base font-semibold">{headline}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Completed {signedKm(result.input.offset)} km from due at every service, projected from{' '}
        {PROJECTION_BASES.find((b) => b.value === result.input.basis).label.toLowerCase()}.
      </p>
      <div className="mt-4 border-t border-neutral-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Stress test — {km(result.stress.count)} scenarios (details at the bottom)
        </p>
        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
          {PROJECTION_BASES.flatMap(({ value, label }) =>
            PLANS.map((plan) => {
              const t = result.stress.totals[value][plan]
              return (
                <li key={`${value}-${plan}`}>
                  <span className="font-medium text-neutral-900">{PLAN_LABELS[plan]}</span> + {label.toLowerCase()}:{' '}
                  {t.with_miss === 0 ? (
                    <span className="text-green-700">no parts missed in any scenario</span>
                  ) : (
                    <span className="text-red-700">
                      missed parts in {km(t.with_miss)} of {km(result.stress.count)} scenarios — worst {km(t.worst.parts_missed)} parts
                      ({describeScenario(t.worst.group, t.worst.scenario).toLowerCase()})
                    </span>
                  )}
                </li>
              )
            }),
          )}
        </ul>
      </div>
    </div>
  )
}

const PLAN_LABELS = { rangeWise: 'Range-wise', static: 'Static' }

const away = (offset) =>
  offset === 0 ? 'exactly on due' : `${km(Math.abs(offset))} km ${offset > 0 ? 'after' : 'before'} due`
const kmSpan = ([from, to]) => (from === to ? `${signedKm(from)} km` : `${signedKm(from)} to ${signedKm(to)} km`)

// Plain-language name and explanation of each stress group.
function groupInfo(group, due) {
  const n = group.scenarios.length
  const span = kmSpan(group.limits)
  const s2Due = due + INTERVAL_KM
  return {
    all_early: ['Every service early', `All ${SERVICE_COUNT} services done the same km before due — tried every km from ${span}.`],
    all_on_due: ['Every service on due', `All ${SERVICE_COUNT} services done exactly at due.`],
    all_slightly_late: ['Every service slightly late', `All services done the same km after due, inside the ±${NEXT_BUFFER_KM} km window — every km from ${span}.`],
    all_very_late: ['Every service very late', `All services done the same km after the window, before the next service's window — every km from ${span}.`],
    one_early: ['Only one service early', `One service done early (every ${50} km, ${span}), all others exactly on due. Tried for each of the ${SERVICE_COUNT} services.`],
    one_slightly_late: ['Only one service slightly late', `One service done late inside its window (every ${50} km, ${span}), all others on due. Tried for each service.`],
    one_very_late: ['Only one service very late', `One service done after its window (every ${50} km, ${span}), all others on due — e.g. service 2 due ${km(s2Due)} done at ${km(s2Due + 550)}. Tried for each service.`],
    mixed_in_window: ['Mixed — each service different, inside window', `Each service gets its own random km between ${span} from due. ${km(n)} random runs.`],
    mixed_any: ['Mixed — each service different, anything', `Each service gets its own random km between ${span} from due: early, on time, late or very late. ${km(n)} random runs.`],
  }[group.key]
}

// One scenario as a sentence.
function describeScenario(groupKey, scenario) {
  if (groupKey.startsWith('all_')) return `Every service done ${away(scenario.offset)}`
  if (groupKey.startsWith('one_')) return `Only service ${scenario.service_no} done ${away(scenario.offset)}, all others on due`
  return `Mixed run ${scenario.run}`
}

// [3, 4, 5, 7] → "S3–S5, S7"
function serviceList(nos) {
  const parts = []
  for (let i = 0; i < nos.length; i += 1) {
    let j = i
    while (j + 1 < nos.length && nos[j + 1] === nos[j] + 1) j += 1
    parts.push(i === j ? `S${nos[i]}` : `S${nos[i]}–S${nos[j]}`)
    i = j
  }
  return parts.join(', ')
}

function GroupResult({ total, count }) {
  if (total.with_miss === 0) return <span className="text-green-700">Never missed</span>
  return (
    <span className="text-red-700">
      <span className="font-medium">Missed in {km(total.with_miss)} of {km(count)}</span>
      <span className="block text-xs text-neutral-500">worst: {km(total.worst.parts_missed)} parts</span>
    </span>
  )
}

function ScenarioResult({ r }) {
  if (r.parts_missed === 0) return <span className="text-green-700">None missed</span>
  return (
    <span className="text-red-700">
      <span className="font-medium">{km(r.parts_missed)} parts</span>
      <span className="block text-xs text-neutral-500">{serviceList(r.missed_services)}</span>
    </span>
  )
}

const cellX = 'px-3 py-2 align-top'
const divider = 'border-l border-neutral-200'

function StressGroup({ group, due }) {
  const [open, setOpen] = useState(false)
  const [title, description] = groupInfo(group, due)
  const cells = (results, Cell) =>
    PROJECTION_BASES.flatMap(({ value }) =>
      PLANS.map((plan, i) => (
        <td key={`${value}-${plan}`} className={`${cellX} ${i === 0 ? divider : ''}`}>
          <Cell {...results(value, plan)} />
        </td>
      )),
    )
  return (
    <>
      <tr className="border-t border-neutral-200">
        <td className={cellX}>
          <p className="font-medium text-neutral-900">{title}</p>
          <p className="mt-0.5 max-w-md text-xs text-neutral-500">{description}</p>
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-xs font-semibold text-blue-700 hover:underline">
            {open ? 'Hide scenarios' : `Show all ${km(group.scenarios.length)} scenarios`}
          </button>
        </td>
        <td className={`${cellX} tabular-nums`}>{km(group.scenarios.length)}</td>
        {cells((basis, plan) => ({ total: group.totals[basis][plan], count: group.scenarios.length }), GroupResult)}
      </tr>
      {open && (
        <tr>
          <td colSpan={2 + PROJECTION_BASES.length * PLANS.length} className="bg-neutral-50 px-3 pb-3">
            <div className="max-h-96 overflow-auto rounded-lg border border-neutral-200 bg-white">
              <table className="min-w-full text-sm tabular-nums">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs font-semibold text-neutral-600">
                  <tr>
                    <th className={cellX}>Scenario</th>
                    {PROJECTION_BASES.flatMap(({ value, label }) =>
                      PLANS.map((plan, i) => (
                        <th key={`${value}-${plan}`} className={`${cellX} ${i === 0 ? divider : ''}`}>
                          {PLAN_LABELS[plan]} <span className="font-normal text-neutral-400">· {label}</span>
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {group.scenarios.map((sc, idx) => (
                    <tr key={idx}>
                      <td className={cellX}>
                        <p className="text-neutral-900">{describeScenario(group.key, sc)}</p>
                        {group.key.startsWith('mixed_') && (
                          <p className="mt-0.5 max-w-md text-xs text-neutral-500">
                            {sc.offsets.map((o, i) => `S${i + 1} ${signedKm(o)}`).join(' · ')}
                          </p>
                        )}
                      </td>
                      {cells((basis, plan) => ({ r: sc.results[basis][plan] }), ScenarioResult)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// Stress test at the bottom of the page: one row per scenario group, each expandable to all its scenarios.
function StressTest({ stress: st, due }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Stress test — {km(st.count)} scenarios</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          A scenario says where each of the {SERVICE_COUNT} services is completed. Every scenario is projected both ways (next due
          from the previous service&apos;s odo, and from the previous projection), and every job card asks both plans for its parts.
          Results show how many scenarios lost parts — parts whose range the bike went past without a job card getting them.
          Open a group to see every scenario in it.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
            <tr>
              <th rowSpan={2} className={cellX}>Scenario group</th>
              <th rowSpan={2} className={cellX}>Scenarios</th>
              {PROJECTION_BASES.map(({ value, label }) => (
                <th key={value} colSpan={PLANS.length} className={`${cellX} ${divider} text-center`}>
                  Next due from {label.toLowerCase()}
                </th>
              ))}
            </tr>
            <tr className="border-t border-neutral-200">
              {PROJECTION_BASES.flatMap(({ value }) =>
                PLANS.map((plan, i) => (
                  <th key={`${value}-${plan}`} className={`${cellX} ${i === 0 ? divider : ''}`}>
                    {PLAN_LABELS[plan]}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {st.groups.map((g) => (
              <StressGroup key={g.key} group={g} due={due} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ServicePartsDemo() {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      logTable('Errors', nextErrors)
      return
    }
    const input = {
      due: Number(form.due),
      lowerBuffer: Number(form.lowerBuffer),
      upperBuffer: Number(form.upperBuffer),
      offset: Number(form.offset),
      basis: form.basis,
    }
    const run = dryRun(input)
    const all = stress(input)
    logTable('Dry run input', input)
    logTable('Range-wise plan — job cards', run.rangeWise.cards.map(({ own_range, parts, ...c }) => ({ ...c, own_range: `${own_range.from}-${own_range.to}`, parts: parts.length })))
    logTable('Range-wise plan — ranges', run.rangeWise.ranges)
    logTable('Static plan — job cards', run.static.cards.map(({ parts, ...c }) => ({ ...c, parts: parts.length })))
    logTable('Summary', [
      { plan: 'range-wise', ...run.rangeWise.summary },
      { plan: 'static', ...run.static.summary },
    ])
    logTable(
      `Stress test — ${all.count} scenarios`,
      all.groups.map((g) => ({
        group: g.key,
        scenarios: g.scenarios.length,
        ...Object.fromEntries(
          PROJECTION_BASES.flatMap(({ value }) => PLANS.map((plan) => [`${value} ${plan} missed in`, g.totals[value][plan].with_miss])),
        ),
      })),
    )
    setResult({ input, ...run, stress: all })
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Service Parts Demo</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Dry run of {SERVICE_COUNT} services with the Demo page&apos;s projection ({km(INTERVAL_KM)} km interval,{' '}
          {km(NEXT_BUFFER_KM)} km buffer from service 2). Range-wise: the job card gets the parts of the odo range its
          projected due falls in (service N&apos;s range = first due + (N − 1) × {km(INTERVAL_KM)} ± buffer). Static: the
          job card gets the parts of its service number.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 sm:px-6">
        <h2 className="text-base font-semibold">Dry Run</h2>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          {fields.map(({ name, label, placeholder }) => (
            <div key={name}>
              <label htmlFor={name} className="block text-sm font-medium text-neutral-700">
                {label} <span className="text-neutral-400">*</span>
              </label>
              <input
                id={name}
                type="number"
                inputMode="numeric"
                value={form[name]}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, [name]: e.target.value }))
                  setErrors((prev) => ({ ...prev, [name]: undefined }))
                }}
                placeholder={placeholder}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
                className={inputClass(errors[name])}
              />
              {errors[name] && (
                <p id={`${name}-error`} className="mt-1 text-xs font-medium text-neutral-900">
                  {errors[name]}
                </p>
              )}
            </div>
          ))}
          <button type="submit" className={`${primaryButton} lg:mt-7`}>
            Run
          </button>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-neutral-700">
            Project next service from <span className="text-neutral-400">*</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {PROJECTION_BASES.map(({ value, label, hint }) => {
              const checked = form.basis === value
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                    checked ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="basis"
                    value={value}
                    checked={checked}
                    onChange={() => setForm((prev) => ({ ...prev, basis: value }))}
                    className="mt-0.5 accent-neutral-900"
                  />
                  <span>
                    <span className="block font-medium text-neutral-900">{label}</span>
                    <span className="block text-xs text-neutral-500">{hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </form>

      {result ? (
        <>
          <Verdict result={result} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <PlanColumn
              tone={tones.range}
              title="Range-wise plan"
              subtitle="Parts by the odo range the projected due falls in"
              run={result.rangeWise}
              columns={rangeColumns}
              footer={<MissedRanges ranges={result.rangeWise.ranges} />}
            />
            <PlanColumn
              tone={tones.static}
              title="Static plan"
              subtitle="Parts by service number (service N → N parts)"
              run={result.static}
              columns={staticColumns}
              footer={<MissedRanges ranges={result.static.ranges} />}
            />
          </div>
          <StressTest stress={result.stress} due={result.input.due} />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No dry run yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Fill the form and run to project {SERVICE_COUNT} services for both plans.</p>
        </div>
      )}
    </div>
  )
}

export default ServicePartsDemo
