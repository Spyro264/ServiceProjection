// localStorage stands in for the real database in this demo.
const VEHICLES_KEY = 'sp_vehicles'
const MASTER_TABLE_KEY = 'mastertable'
const SERVICE_RULES_KEY = 'service_rules'
const SERVICE_RULE_ITEMS_KEY = 'service_rule_items'
const JOB_CARDS_KEY = 'jobcards'
const SERVICES_KEY = 'services'
const UNPLANNED_KEY = 'unplanned'
const TAGS_KEY = 'tags'
const BIKES_KEY = 'bikes'
const TYPES_KEY = 'types'

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

// A service rule is two tables: one row per rule in service_rules (parent) and one row per schedule entry
// in service_rule_items (child), linked by ruleId and ordered by sequence.
export const loadServiceRules = () => load(SERVICE_RULES_KEY)
export const loadServiceRuleItems = () => load(SERVICE_RULE_ITEMS_KEY)

// Rules joined back into { id, name, createdAt, schedule }. Rules saved earlier in the single mastertable are kept as they are.
export function loadMasterRules() {
  const items = loadServiceRuleItems()
  const joined = loadServiceRules().map((rule) => ({
    ...rule,
    schedule: items
      .filter((item) => item.ruleId === rule.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map((item) => {
        const entry = { serviceNo: item.sequence, ...item }
        delete entry.id
        delete entry.ruleId
        delete entry.sequence
        return entry
      }),
  }))
  return [...joined, ...load(MASTER_TABLE_KEY)]
}

// Saves a { id, name, createdAt, schedule } rule as 1 parent row and N child rows.
export function addMasterRule({ schedule, ...rule }) {
  const items = schedule.map(({ serviceNo, ...entry }) => ({ id: crypto.randomUUID(), ruleId: rule.id, sequence: serviceNo, ...entry }))
  save(SERVICE_RULES_KEY, [rule, ...loadServiceRules()])
  save(SERVICE_RULE_ITEMS_KEY, [...loadServiceRuleItems(), ...items])
  return { rule, items }
}

export const loadJobCards = () => load(JOB_CARDS_KEY)
export const saveJobCards = (jobCards) => save(JOB_CARDS_KEY, jobCards)

export const loadServices = () => load(SERVICES_KEY)
export const saveServices = (services) => save(SERVICES_KEY, services)

export const loadUnplanned = () => load(UNPLANNED_KEY)
export const saveUnplanned = (rows) => save(UNPLANNED_KEY, rows)

export const loadTags = () => load(TAGS_KEY)
export const saveTags = (tags) => save(TAGS_KEY, tags)

// Service types picked for the 2nd service onward in Service Plan Setup.
export const loadTypes = () => load(TYPES_KEY)
export const saveTypes = (types) => save(TYPES_KEY, types)

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
  for (const key of [VEHICLES_KEY, MASTER_TABLE_KEY, SERVICE_RULES_KEY, SERVICE_RULE_ITEMS_KEY, JOB_CARDS_KEY, SERVICES_KEY, UNPLANNED_KEY, TAGS_KEY, BIKES_KEY, TYPES_KEY]) {
    localStorage.removeItem(key)
  }
}
