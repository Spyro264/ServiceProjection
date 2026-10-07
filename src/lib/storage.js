// localStorage stands in for the real database in this demo.
const VEHICLES_KEY = 'sp_vehicles'
const MASTER_TABLE_KEY = 'mastertable'
const JOB_CARDS_KEY = 'jobcards'
const SERVICES_KEY = 'services'
const UNPLANNED_KEY = 'unplanned'

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

export function clearAllData() {
  for (const key of [VEHICLES_KEY, MASTER_TABLE_KEY, JOB_CARDS_KEY, SERVICES_KEY, UNPLANNED_KEY]) localStorage.removeItem(key)
}
