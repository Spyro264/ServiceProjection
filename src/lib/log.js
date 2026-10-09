// Console logs are shown as tables: a list is one row per item, a single record is one row.
export function logTable(label, data) {
  console.log(label)
  console.table(Array.isArray(data) ? data : [data])
}
