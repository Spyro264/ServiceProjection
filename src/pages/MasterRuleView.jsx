import { useState } from 'react'
import { loadMasterRules } from '../lib/storage.js'

const groups = [
  { label: 'KM', keys: ['firstServiceKm', 'secondServiceKm', 'thirdServiceKm', 'recursiveKm', 'kmLimit'] },
  { label: 'Days', keys: ['firstServiceDays', 'secondServiceDays', 'thirdServiceDays', 'recursiveDays', 'dayLimit'] },
]

const subLabels = ['1st', '2nd', '3rd', 'Recursive', 'Limit']

const columns = ['model', 'year', ...groups.flatMap((g) => g.keys)]

function MasterRuleView() {
  const [rules] = useState(loadMasterRules)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Master Rule View</h1>
        <p className="mt-1 text-sm text-neutral-500">All saved master rules.</p>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <h3 className="text-sm font-semibold">No master rules yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Rules you add will show up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th rowSpan={2} className="px-4 py-3 align-bottom">Model</th>
                <th rowSpan={2} className="px-4 py-3 align-bottom">Year</th>
                {groups.map(({ label }) => (
                  <th key={label} colSpan={5} className="border-b border-l border-neutral-200 px-4 pt-3 pb-2 text-center">
                    {label}
                  </th>
                ))}
              </tr>
              <tr>
                {groups.flatMap(({ label: group }) =>
                  subLabels.map((label, i) => (
                    <th key={`${group}-${label}`} className={`px-4 pt-2 pb-3 ${i === 0 ? 'border-l border-neutral-200' : ''}`}>
                      {label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="whitespace-nowrap">
                  {columns.map((key) => (
                    <td
                      key={key}
                      className={`px-4 py-3 ${key === 'model' ? 'font-medium text-neutral-900' : 'text-neutral-700'} ${
                        groups.some((g) => g.keys[0] === key) ? 'border-l border-neutral-200' : ''
                      }`}
                    >
                      {rule[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MasterRuleView
