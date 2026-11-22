// Spare parts module (demo). The job card calls it with a service number and gets back the parts for that service.
// The mapping is hardcoded for services 1–35; the call takes CALL_MS so the job card can show it calling the module.
export const CALL_MS = 5000

// Service N has N parts: Engine oil in every service, plus N − 1 parts used by no other service.
// Every other part name is tagged with its service (e.g. "Air filter (S7)") so no part repeats across services;
// the starting name rotates per service so neighbouring services don't all begin the same way.
const COMMON_PART = 'Engine oil'
const PART_NAMES = [
  'Oil filter', 'Air filter', 'Spark plug', 'Chain lube', 'Drive chain', 'Chain sprocket kit', 'Brake shoe (rear)',
  'Brake pads (front)', 'Brake fluid', 'Clutch cable', 'Accelerator cable', 'Brake cable', 'Clutch plates', 'Gear oil',
  'Coolant', 'Fork oil', 'Fork oil seal', 'Headlamp bulb', 'Indicator bulb', 'Horn', 'Battery', 'Fuse set',
  'Fuel filter', 'Drive belt', 'Roller weights', 'Clutch shoe', 'Wheel bearing (front)', 'Wheel bearing (rear)',
  'Steering bearing', 'Muffler gasket', 'Valve cover gasket', 'Side stand spring', 'Grip rubbers', 'Mirror set',
]
const LAST_SERVICE = 35

const SPARE_PARTS_BY_SERVICE = {}
for (let n = 1; n <= LAST_SERVICE; n += 1) {
  const others = Array.from({ length: n - 1 }, (_, i) => `${PART_NAMES[(n + i) % PART_NAMES.length]} (S${n})`)
  SPARE_PARTS_BY_SERVICE[n] = [COMMON_PART, ...others]
}

// Parts for a service number; services past 35 get no parts.
export function sparePartsFor(serviceNo) {
  return SPARE_PARTS_BY_SERVICE[serviceNo] ?? []
}

// What the job card calls: resolves with the service's parts after CALL_MS.
export function callSparePartsModule(serviceNo) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(sparePartsFor(serviceNo)), CALL_MS)
  })
}
