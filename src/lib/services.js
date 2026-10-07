import { findRule, projectService, serviceLabel, serviceTypeOf } from './projection.js'
import {
  loadJobCards,
  loadMasterRules,
  loadServices,
  loadVehicles,
  saveJobCards,
  saveServices,
  saveVehicles,
} from './storage.js'

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

  console.log('Job card created', jobCard)
  console.log('Service projected', service)
  return jobCard
}

const noDataRows = (vehicle, count, now) =>
  Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    vehicleId: vehicle.id,
    regNo: vehicle.regNo,
    model: vehicle.model,
    projectedAt: now,
    serviceNo: i + 1,
    serviceType: serviceTypeOf(i + 1),
    status: 'No Data',
  }))

// Older vehicles: slots before the last service have no data; the last service is entered at onboarding.
export function recordPreviousServices(vehicle, { serviceNo, kmDoneAt, doneDate }) {
  const now = new Date().toISOString()
  const rows = [
    ...noDataRows(vehicle, serviceNo - 1, now),
    {
      id: crypto.randomUUID(),
      vehicleId: vehicle.id,
      regNo: vehicle.regNo,
      model: vehicle.model,
      projectedAt: now,
      serviceNo,
      serviceType: serviceTypeOf(serviceNo),
      kmDoneAt,
      doneDate,
      status: 'Recorded',
      basis: 'Last service entered at onboarding (older vehicle).',
    },
  ]
  saveServices([...loadServices(), ...rows])
  console.log('Previous services recorded', rows)
}

// Older vehicles with no service history: past services (estimated from age) are saved as No Data.
export function recordEstimatedServices(vehicle, count) {
  if (count === 0) return
  const rows = noDataRows(vehicle, count, new Date().toISOString())
  saveServices([...loadServices(), ...rows])
  console.log('Estimated past services recorded', rows)
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
          serviceType: jobCard.serviceType ?? serviceTypeOf(jobCard.serviceNo),
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
        serviceType: serviceTypeOf(lateServiceNo),
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

  const vehicle = loadVehicles().find((v) => v.id === jobCard.vehicleId)
  if (!vehicle) return { lateServiceNo, nextJobCard: null }
  // Use the current master rule for the model, so a newer rule takes effect on the next projection.
  const rules = loadMasterRules()
  const rule = findRule(rules, vehicle.model, vehicle.invoiceDate) ?? rules.find((r) => r.id === vehicle.ruleId)
  if (!rule) return { lateServiceNo, nextJobCard: null }

  const projection = projectService(rule, vehicle.invoiceDate, nextNo, jobCard)
  return { lateServiceNo, nextJobCard: scheduleService(vehicle, projection) }
}
