// Multi-select list of bikes. `selected` is an array of bike ids.
function BikePicker({ bikes, selected, onChange }) {
  if (bikes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
        <h3 className="text-sm font-semibold">No free bikes</h3>
        <p className="mt-1 text-sm text-neutral-500">Every bike already has a tag.</p>
      </div>
    )
  }

  const allSelected = selected.length === bikes.length

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onChange(allSelected ? [] : bikes.map((b) => b.id))}
                aria-label="Select all bikes"
                className="size-4 rounded border-neutral-300 accent-neutral-900"
              />
            </th>
            <th className="px-4 py-3">Reg No</th>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Year</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {bikes.map((bike) => (
            <tr key={bike.id} onClick={() => toggle(bike.id)} className="cursor-pointer whitespace-nowrap hover:bg-neutral-50">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.includes(bike.id)}
                  onChange={() => toggle(bike.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${bike.regNo}`}
                  className="size-4 rounded border-neutral-300 accent-neutral-900"
                />
              </td>
              <td className="px-4 py-3 font-medium text-neutral-900">{bike.regNo}</td>
              <td className="px-4 py-3 text-neutral-700">{bike.model}</td>
              <td className="px-4 py-3 text-neutral-700">{bike.year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default BikePicker
