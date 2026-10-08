// localStorage stands in for the real database in this demo.
const VEHICLES_KEY = 'sp_vehicles'
const MASTER_TABLE_KEY = 'mastertable'
const JOB_CARDS_KEY = 'jobcards'
const SERVICES_KEY = 'services'
const UNPLANNED_KEY = 'unplanned'
const TAGS_KEY = 'tags'
const BIKES_KEY = 'bikes'

// Dummy bikes to pick from when assigning a tag. tagId is null until a tag is assigned.
const DUMMY_BIKE_MODELS = [
  ['Activa 6G', 2024],
  ['Activa 6G', 2025],
  ['Jupiter', 2024],
  ['Pulsar 150', 2023],
  ['Splendor Plus', 2025],
]
// Three series of 5: KA01AB3001-3005, KA01AB4001-4005, KA01AB5001-5005.
const DUMMY_BIKE_SERIES = [3, 4, 5]
const dummyBikes = DUMMY_BIKE_SERIES.flatMap((series) =>
  DUMMY_BIKE_MODELS.map(([model, year], i) => {
    const number = series * 1000 + i + 1
    return { id: `bike-${number}`, regNo: `KA01AB${number}`, model, year, tagId: null }
  }),
)

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? []
  } catch {
    return []
  }
}

function save(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows))
}

export const loadVehicles = () => load(VEHICLES_KEY)
export const saveVehicles = (vehicles) => save(VEHICLES_KEY, vehicles)

export const loadMasterRules = () => load(MASTER_TABLE_KEY)
export const saveMasterRules = (rules) => save(MASTER_TABLE_KEY, rules)

export const loadJobCards = () => load(JOB_CARDS_KEY)
export const saveJobCards = (jobCards) => save(JOB_CARDS_KEY, jobCards)

export const loadServices = () => load(SERVICES_KEY)
export const saveServices = (services) => save(SERVICES_KEY, services)

export const loadUnplanned = () => load(UNPLANNED_KEY)
export const saveUnplanned = (rows) => save(UNPLANNED_KEY, rows)

export const loadTags = () => load(TAGS_KEY)
export const saveTags = (tags) => save(TAGS_KEY, tags)

// Replaces a missing or older saved bike list with the current dummy bikes, keeping tags on bikes that still exist.
export function loadBikes() {
  const stored = load(BIKES_KEY)
  const upToDate = stored.length === dummyBikes.length && dummyBikes.every((d) => stored.some((b) => b.id === d.id))
  if (!upToDate) {
    save(BIKES_KEY, dummyBikes.map((d) => ({ ...d, tagId: stored.find((b) => b.id === d.id)?.tagId ?? null })))
  }
  return load(BIKES_KEY)
}
export const saveBikes = (bikes) => save(BIKES_KEY, bikes)

export function assignBikesToTag(bikeIds, tagId) {
  const bikes = loadBikes().map((bike) => (bikeIds.includes(bike.id) ? { ...bike, tagId } : bike))
  saveBikes(bikes)
  return bikes
}

export function clearAllData() {
  for (const key of [VEHICLES_KEY, MASTER_TABLE_KEY, JOB_CARDS_KEY, SERVICES_KEY, UNPLANNED_KEY, TAGS_KEY, BIKES_KEY]) {
    localStorage.removeItem(key)
  }
}
