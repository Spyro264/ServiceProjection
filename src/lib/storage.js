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
const PARTS_KEY = 'parts'
const MODEL_PARTS_KEY = 'model_part_assignments'
const PARTS_RULES_KEY = 'parts_rules'
const PARTS_RULE_ITEMS_KEY = 'parts_rule_items'
const SERVICE_PROJECTION_KEY = 'service_projection'
const DEMO_JOB_CARDS_KEY = 'demo_job_cards'
const DEMO_SERVICES_KEY = 'demo_services'

// Dummy bikes to pick from when assigning a tag. tagId is null until a tag is assigned.
const DUMMY_BIKE_MODELS = [
  ['Activa 6G', 2024],
  ['Activa 6G', 2025],
  ['Jupiter', 2024],
  ['Pulsar 150', 2023],
  ['Splendor Plus', 2025],
  ['Activa 5G', 2022],
]
// Three series of 6: KA01AB3001-3006, KA01AB4001-4006, KA01AB5001-5006.
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

// Replaces a rule's schedule (its service_rule_items rows), keeping each row's id.
export function updateMasterRuleSchedule(ruleId, schedule) {
  const items = loadServiceRuleItems()
  const idOf = Object.fromEntries(items.filter((item) => item.ruleId === ruleId).map((item) => [item.sequence, item.id]))
  const updated = schedule.map(({ serviceNo, ...entry }) => ({ id: idOf[serviceNo] ?? crypto.randomUUID(), ruleId, sequence: serviceNo, ...entry }))
  save(SERVICE_RULE_ITEMS_KEY, [...items.filter((item) => item.ruleId !== ruleId), ...updated])
  return updated
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

// Bike models (distinct, sorted) from the bikes table. Each model is separate, e.g. Activa 5G and Activa 6G.
export const loadBikeModels = () => [...new Set(loadBikes().map((bike) => bike.model))].sort()

// Spare parts, not tied to any model: { id, name, createdAt }.
export const loadParts = () => load(PARTS_KEY)
export const saveParts = (parts) => save(PARTS_KEY, parts)

// Parts assigned to a bike model, one row per model + part: { id, model, partId, createdAt }.
export const loadModelParts = () => load(MODEL_PARTS_KEY)

// Parts assigned to a model, in the order they were added on the Parts page.
export function loadPartsForModel(model) {
  const assigned = new Set(loadModelParts().filter((row) => row.model === model).map((row) => row.partId))
  return loadParts().filter((part) => assigned.has(part.id))
}

// Replaces a model's assigned parts with partIds, keeping the rows of parts that stay assigned.
export function assignPartsToModel(model, partIds) {
  const rows = loadModelParts()
  const kept = rows.filter((row) => row.model === model && partIds.includes(row.partId))
  const added = partIds
    .filter((partId) => !kept.some((row) => row.partId === partId))
    .map((partId) => ({ id: crypto.randomUUID(), model, partId, createdAt: new Date().toISOString() }))
  const next = [...rows.filter((row) => row.model !== model), ...kept, ...added]
  save(MODEL_PARTS_KEY, next)
  return next
}

// A parts rule is two tables like a service rule: one row per rule in parts_rules ({ id, model, createdAt }) and one row
// per service in parts_rule_items ({ id, ruleId, sequence, partIds }), sequence being the service number.
export const loadPartsRules = () => load(PARTS_RULES_KEY)
export const loadPartsRuleItems = () => load(PARTS_RULE_ITEMS_KEY)

// A model's saved services as [{ serviceNo, partIds }] in service order, or null when the model has no parts rule.
export function loadPartsRuleServices(model) {
  const rule = loadPartsRules().find((r) => r.model === model)
  if (!rule) return null
  return loadPartsRuleItems()
    .filter((item) => item.ruleId === rule.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((item) => ({ serviceNo: item.sequence, partIds: item.partIds }))
}

// A model has one parts rule: the first save adds the parent row, later saves replace its child rows.
// services: [{ serviceNo, partIds }].
export function savePartsRule(model, services) {
  const rules = loadPartsRules()
  let rule = rules.find((r) => r.model === model)
  if (!rule) {
    rule = { id: crypto.randomUUID(), model, createdAt: new Date().toISOString() }
    save(PARTS_RULES_KEY, [rule, ...rules])
  }
  const items = services.map(({ serviceNo, partIds }) => ({ id: crypto.randomUUID(), ruleId: rule.id, sequence: serviceNo, partIds }))
  save(PARTS_RULE_ITEMS_KEY, [...loadPartsRuleItems().filter((item) => item.ruleId !== rule.id), ...items])
  return { rule, items }
}

// DemoTest page: one row per service in the demo projection chain.
export const loadServiceProjection = () => load(SERVICE_PROJECTION_KEY)
export const saveServiceProjection = (rows) => save(SERVICE_PROJECTION_KEY, rows)

// DemoTest page: one job card per projected service.
export const loadDemoJobCards = () => load(DEMO_JOB_CARDS_KEY)
export const saveDemoJobCards = (cards) => save(DEMO_JOB_CARDS_KEY, cards)

// DemoTest page: one services row per closed job card (done / lapsed / delayed completion).
export const loadDemoServices = () => load(DEMO_SERVICES_KEY)
export const saveDemoServices = (rows) => save(DEMO_SERVICES_KEY, rows)

export function clearAllData() {
  for (const key of [
    VEHICLES_KEY,
    MASTER_TABLE_KEY,
    SERVICE_RULES_KEY,
    SERVICE_RULE_ITEMS_KEY,
    JOB_CARDS_KEY,
    SERVICES_KEY,
    UNPLANNED_KEY,
    TAGS_KEY,
    BIKES_KEY,
    TYPES_KEY,
    PARTS_KEY,
    MODEL_PARTS_KEY,
    'model_parts', // old model-specific parts table
    PARTS_RULES_KEY,
    PARTS_RULE_ITEMS_KEY,
    SERVICE_PROJECTION_KEY,
    DEMO_JOB_CARDS_KEY,
    DEMO_SERVICES_KEY,
  ]) {
    localStorage.removeItem(key)
  }
}
