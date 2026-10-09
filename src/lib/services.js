import { projectService, serviceLabel, serviceTypeOf } from './projection.js'
import {
  loadBikes,
  loadJobCards,
  loadMasterRules,
  loadServices,
  loadTags,
  loadVehicles,
  saveJobCards,
  saveServices,
  saveVehicles,
} from './storage.js'
import { logTable } from './log.js'

export const SERVICE_CENTERS = ['Hub', 'Warehouse', 'Service Station']

// Job card fields copied onto the vehicle's service row.
const jobCardFields = ({ items, serviceDays, serviceCenter, kmDoneAt, doneDate, overKm, overDate, status, closedAt, pulledForwardBy }) => ({
  pulledForwardBy,
  items,
  serviceDays,
  serviceCenter,
  kmDoneAt,
  doneDate,
  overKm,
  overDate,
  status,
  closedAt,
})

// A projected service gets a Pending job card and a Pending row in the services table.
export function scheduleService(vehicle, projection) {
  const now = new Date().toISOString()
  const jobCards = loadJobCards()
  const jobCard = {
    id: crypto.randomUUID(),
    jobCardNo: `JC-${String(jobCards.length + 1).padStart(4, '0')}`,
    vehicleId: vehicle.id,
    regNo: vehicle.regNo,
    model: vehicle.model,
    ...projection,
    status: 'Pending',
    createdAt: now,
  }
  saveJobCards([jobCard, ...jobCards])

  const service = {
    id: crypto.randomUUID(),
    vehicleId: vehicle.id,
    regNo: vehicle.regNo,
    model: vehicle.model,
    ...projection,
    jobCardId: jobCard.id,
    jobCardNo: jobCard.jobCardNo,
    status: 'Pending',
    projectedAt: now,
  }
  saveServices([...loadServices(), service])

  const vehicles = loadVehicles().map((v) => (v.id === vehicle.id ? { ...v, projection } : v))
  saveVehicles(vehicles)

  logTable('Job card created', jobCard)
  logTable('Service projected', service)
  return jobCard
}

// The bike's tag (from the bikes table) and that tag's service rule. Either is undefined when missing.
export function tagRuleFor(regNo) {
  const bike = loadBikes().find((b) => b.regNo === regNo)
  const tag = bike?.tagId ? loadTags().find((t) => t.id === bike.tagId) : undefined
  const rule = tag ? loadMasterRules().find((r) => r.id === tag.ruleId) : undefined
  return { tag, rule }
}

// Services follow the bike's tag. Vehicles onboarded before tags fall back to the rule saved on them.
export function currentRule(vehicle) {
  return tagRuleFor(vehicle.regNo).rule ?? loadMasterRules().find((r) => r.id === vehicle.ruleId)
}

const noDataRows = (vehicle, rule, count, now) =>
  Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    vehicleId: vehicle.id,
    regNo: vehicle.regNo,
    model: vehicle.model,
    projectedAt: now,
    serviceNo: i + 1,
    serviceType: serviceTypeOf(i + 1, rule),
    status: 'No Data',
  }))

// Older vehicles: slots before the last service have no data; the last service is entered at onboarding.
export function recordPreviousServices(vehicle, rule, { serviceNo, kmDoneAt, doneDate }) {
  const now = new Date().toISOString()
  const rows = [
    ...noDataRows(vehicle, rule, serviceNo - 1, now),
    {
      id: crypto.randomUUID(),
      vehicleId: vehicle.id,
      regNo: vehicle.regNo,
      model: vehicle.model,
      projectedAt: now,
      serviceNo,
      serviceType: serviceTypeOf(serviceNo, rule),
      kmDoneAt,
      doneDate,
      status: 'Recorded',
      basis: 'Last service entered at onboarding (older vehicle).',
    },
  ]
  saveServices([...loadServices(), ...rows])
  logTable('Previous services recorded', rows)
}

// Older vehicles with no service history: past services (estimated from age) are saved as No Data.
export function recordEstimatedServices(vehicle, rule, count) {
  if (count === 0) return
  const rows = noDataRows(vehicle, rule, count, new Date().toISOString())
  saveServices([...loadServices(), ...rows])
  logTable('Estimated past services recorded', rows)
}

// Copies the job card's latest details onto its service row.
export function syncService(jobCard) {
  const services = loadServices()
  const exists = services.some((s) => s.jobCardId === jobCard.id)
  const next = exists
    ? services.map((s) => (s.jobCardId === jobCard.id ? { ...s, ...jobCardFields(jobCard) } : s))
    : [
        ...services,
        {
          id: crypto.randomUUID(),
          vehicleId: jobCard.vehicleId,
          regNo: jobCard.regNo,
          model: jobCard.model,
          serviceNo: jobCard.serviceNo,
          serviceType: jobCard.serviceType,
          kmFrom: jobCard.kmFrom,
          kmTo: jobCard.kmTo,
          dueDateFrom: jobCard.dueDateFrom,
          dueDateTo: jobCard.dueDateTo,
          basis: jobCard.basis,
          jobCardId: jobCard.id,
          jobCardNo: jobCard.jobCardNo,
          projectedAt: jobCard.createdAt,
          ...jobCardFields(jobCard),
        },
      ]
  saveServices(next)
}

// Result of closing a planned job card. Due on whichever comes first:
// crossing either the km or the date limit = Lapsed. Done early = Completed.
export function closeOutcome(jobCard, { kmDoneAt, doneDate }) {
  const overKm = kmDoneAt > jobCard.kmTo
  const overDate = doneDate > jobCard.dueDateTo
  return {
    kmDoneAt,
    doneDate,
    status: overKm || overDate ? 'Lapsed' : 'Completed',
    overKm,
    overDate,
    closedAt: new Date().toISOString(),
  }
}

// Records a Completed/Lapsed job card and projects the next service.
// Lapsed: the slot stays lapsed, this work takes the next slot, and the one after is projected.
// Returns { lateServiceNo, nextJobCard }.
export function closeService(jobCard) {
  syncService(jobCard)

  const vehicle = loadVehicles().find((v) => v.id === jobCard.vehicleId)
  const rule = vehicle && currentRule(vehicle)
  let nextNo = jobCard.serviceNo + 1
  let lateServiceNo = null
  if (jobCard.status === 'Lapsed') {
    lateServiceNo = nextNo
    saveServices([
      ...loadServices(),
      {
        id: crypto.randomUUID(),
        vehicleId: jobCard.vehicleId,
        regNo: jobCard.regNo,
        model: jobCard.model,
        serviceNo: lateServiceNo,
        serviceType: rule ? serviceTypeOf(lateServiceNo, rule) : 'PMS',
        lateFor: jobCard.serviceNo,
        basis: `Late work for the lapsed ${serviceLabel(jobCard.serviceNo)}. It takes the next slot.`,
        jobCardId: jobCard.id,
        jobCardNo: jobCard.jobCardNo,
        projectedAt: jobCard.closedAt,
        ...jobCardFields(jobCard),
        overKm: false,
        overDate: false,
        status: 'Completed',
      },
    ])
    nextNo += 1
  }

  if (!vehicle || !rule) return { lateServiceNo, nextJobCard: null }

  // The job card carries both the actual service (km / date done) and its projected window.
  const projection = projectService(rule, vehicle.invoiceDate, nextNo, jobCard)
  return { lateServiceNo, nextJobCard: projection && scheduleService(vehicle, projection) }
}
