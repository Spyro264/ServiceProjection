import { useEffect, useRef, useState } from 'react'

// Dropdown that picks several options. options: [{ value, label }], value: array of picked option values.
function MultiSelect({ id, options, value, onChange, placeholder = 'Select', error, describedBy }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef(null)

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return
    function handleMouseDown(e) {
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const query = search.trim().toLowerCase()
  const shown = query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options
  const picked = options.filter((option) => value.includes(option.value))

  function toggle(optionValue) {
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue])
  }

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        id={id}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          setSearch('')
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 ${
          error ? 'border-neutral-900 focus:ring-neutral-900/20' : 'border-neutral-300 focus:border-neutral-900 focus:ring-brand'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-neutral-400">{placeholder}</span>
        {picked.length > 0 && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-neutral-950">{picked.length}</span>
        )}
        <svg
          className={`size-4 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        // Enter inside the list must not submit the surrounding form; it just closes the list.
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              setOpen(false)
            }
          }}
          className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-100 p-2">
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              aria-label="Search options"
              className="block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-500">No match for "{search.trim()}".</li>
            ) : (
              shown.map((option) => {
                const checked = value.includes(option.value)
                return (
                  <li key={option.value} role="option" aria-selected={checked}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${checked ? 'bg-brand/15' : 'hover:bg-neutral-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(option.value)}
                        className="size-4 accent-neutral-900"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">{option.label}</span>
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}

      {/* Picked options, listed below the dropdown. */}
      {picked.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {picked.map((option) => (
            <li
              key={option.value}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-brand/15 py-1 pl-3 pr-1.5 text-sm font-medium text-neutral-900"
            >
              {option.label}
              <button
                type="button"
                onClick={() => toggle(option.value)}
                aria-label={`Remove ${option.label}`}
                className="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-900/10 hover:text-neutral-900"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MultiSelect
