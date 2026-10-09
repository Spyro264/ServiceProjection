# projectService: plan for the real DB

How the next service for a bike is projected when a service rule has many sub rules (cards).
The service number is **not passed in**: `projectService(bikeId)` works it out from the bike's history.

Assumptions:
- Every bike row has its invoice date.
- Older bikes already have their last service saved in `services`.

---

## Tables

### `service_rules`: one row per rule (parent)

| column | example |
|---|---|
| id | `R1` |
| name | `Activa Standard Plan` |
| created_at | `2026-10-09` |

### `service_rule_items`: one row per card (child)

| column | card 1 | card 2 | card 3 |
|---|---|---|---|
| id | `I1` | `I2` | `I3` |
| rule_id | `R1` | `R1` | `R1` |
| sequence | 1 | 2 | 3 |
| type | Free | free | free |
| days | 30 | 90 | 180 |
| km | 1000 | 2500 | 5000 |
| days_lower / days_upper | 5 / 5 | 15 / 15 | 15 / 15 |
| km_lower / km_upper | 200 / 0 | 500 / 500 | 500 / 500 |
| base | invoice | actual | actual |
| is_recursive | false | false | true |
| count | 1 | 1 | 10 |
| km_interval | | | 2500 |

### Other tables used

| table | columns used |
|---|---|
| `bikes` | id, reg_no, invoice_date, tag_id |
| `tags` | id, name, rule_id |
| `services` | id, bike_id, service_no, service_type, rule_item_id, status, km_from, km_to, due_date_from, due_date_to, km_done_at, done_date, basis |
| `job_cards` | id, service_id, bike_id, status |

Add a unique index on `services (bike_id, service_no)`. If two requests project the same bike at the same moment, the second insert fails instead of creating a duplicate.

---

## The code

```js
import { db } from './db.js' // any SQL client: db.query(sql, params) returns rows

const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// 1. The bike's rule: bike → tag → rule, plus its sub rules in order.
async function getRuleForBike(bikeId) {
  const [rule] = await db.query(
    `SELECT r.* FROM bikes b
       JOIN tags t          ON t.id = b.tag_id
       JOIN service_rules r ON r.id = t.rule_id
      WHERE b.id = $1`,
    [bikeId],
  )
  if (!rule) return null
  rule.items = await db.query(
    `SELECT * FROM service_rule_items WHERE rule_id = $1 ORDER BY sequence`,
    [rule.id],
  )
  return rule
}

// 2. Every service row for the bike, oldest first.
function getServiceHistory(bikeId) {
  return db.query(`SELECT * FROM services WHERE bike_id = $1 ORDER BY service_no`, [bikeId])
}

// 3. Next service number = highest used + 1. last = the latest service actually done.
function findNextService(history) {
  if (history.some((s) => s.status === 'Pending')) return { pending: true }
  if (history.length === 0) return { serviceNo: 1, last: null }
  const highest = history[history.length - 1].service_no
  const last = history.findLast((s) => s.km_done_at != null) ?? null
  return { serviceNo: highest + 1, last }
}

// 4. Which sub rule covers this service number. A recursive item covers `count` numbers.
function findRuleItem(items, serviceNo) {
  let covered = 0
  for (const item of items) {
    covered += item.is_recursive ? item.count : 1
    if (serviceNo <= covered) return item
  }
  return null // the rule has run out
}

// 5. The point the window is counted from.
function getStartPoint(item, bike, last) {
  if (item.base === 'invoice') {
    return { km: 0, date: bike.invoice_date, from: 'invoice date' }
  }
  if (!last) return null
  if (item.base === 'projected' && last.km_to != null) {
    return { km: last.km_to, date: last.due_date_to, from: 'previous projected service' }
  }
  return { km: last.km_done_at, date: last.done_date, from: 'last service' }
}

// 6. Due window = start + ideal, widened by the lower / upper buffers.
function calcWindow(item, start) {
  return {
    km_from: start.km + item.km - item.km_lower,
    km_to: start.km + item.km + item.km_upper,
    due_date_from: addDays(start.date, item.days - item.days_lower),
    due_date_to: addDays(start.date, item.days + item.days_upper),
  }
}

// 7. Saves the Pending service row and its job card together.
async function saveProjection(p) {
  await db.transaction(async (tx) => {
    const [service] = await tx.query(
      `INSERT INTO services
         (bike_id, service_no, service_type, rule_item_id, status,
          km_from, km_to, due_date_from, due_date_to, basis)
       VALUES ($1, $2, $3, $4, 'Pending', $5, $6, $7, $8, $9)
       RETURNING id`,
      [p.bike_id, p.service_no, p.service_type, p.rule_item_id,
       p.km_from, p.km_to, p.due_date_from, p.due_date_to, p.basis],
    )
    await tx.query(
      `INSERT INTO job_cards (service_id, bike_id, status) VALUES ($1, $2, 'Pending')`,
      [service.id, p.bike_id],
    )
  })
}

// 8. MAIN: projects the next service for one bike.
export async function projectService(bikeId) {
  const [bike] = await db.query(`SELECT * FROM bikes WHERE id = $1`, [bikeId])
  if (!bike) return { skipped: 'Bike not found' }
  if (!bike.invoice_date) return { skipped: 'No invoice date' }

  const rule = await getRuleForBike(bikeId)
  if (!rule) return { skipped: 'Bike has no tag, or the tag has no rule' }

  const next = findNextService(await getServiceHistory(bikeId))
  if (next.pending) return { skipped: 'Already has a pending service' }

  const item = findRuleItem(rule.items, next.serviceNo)
  if (!item) return { skipped: 'Rule finished, no more services' }

  const start = getStartPoint(item, bike, next.last)
  if (!start) return { skipped: 'No previous service to count from' }

  const projection = {
    bike_id: bike.id,
    service_no: next.serviceNo,
    service_type: item.type,
    rule_item_id: item.id,
    ...calcWindow(item, start),
    basis: `${item.type} from the ${start.from} (${start.km} km on ${start.date}) using rule "${rule.name}" item ${item.sequence}`,
  }
  await saveProjection(projection)
  return { projection }
}

// 9. Runs when a rule is assigned to a tag: projects every bike in the tag.
export async function projectTag(tagId) {
  const bikes = await db.query(`SELECT id, reg_no FROM bikes WHERE tag_id = $1`, [tagId])
  const results = []
  for (const bike of bikes) {
    results.push({ reg_no: bike.reg_no, ...(await projectService(bike.id)) })
  }
  return results // one row per bike: the projection, or why it was skipped
}
```

---

## What each function does

### 1. `getRuleForBike(bikeId)`
Follows bike → tag → rule, then loads that rule's cards (child rows) sorted by `sequence`.

### 2. `getServiceHistory(bikeId)`
Gets every service row the bike has had, in order of service number.

### 3. `findNextService(history)`: the automatic service number
- If there is a **Pending** row, it stops, so a bike never has two open projections.
- No history means this is the **1st** service.
- Otherwise the next number is **highest service number + 1**.
- `last` is the newest row that has a km done. The next window is counted from it.

| Bike's history | Next service number | `last` |
|---|---|---|
| Nothing yet (new bike) | 1 | none |
| 1st Completed at 950 km on 1 Feb | 2 | the 1st service row |
| 1st and 2nd done, 3rd Lapsed, late work saved as 4th | 5 | the 4th row |
| Has a Pending row | skipped | |

Lapses need nothing extra. When a service lapses, the late work is saved in the next slot, so "+1" skips correctly.

### 4. `findRuleItem(items, serviceNo)`: which card to use
Walks the cards, adding up how many service numbers each covers (`count` if recursive, otherwise 1).

| card | count | covers services |
|---|---|---|
| 1 Free | 1 | 1 |
| 2 free | 1 | 2 |
| 3 free (recursive) | 10 | 3 to 12 |

Service 13 returns `null`, so the plan has ended.

### 5. `getStartPoint(item, bike, last)`: what the window is counted from

| base | start km | start date |
|---|---|---|
| `invoice` | 0 | invoice date |
| `actual` | km at the last service | date of the last service |
| `projected` | end of the last projected km window (`km_to`) | end of the last projected date window (`due_date_to`) |

If `projected` is set but the last service has no projected window (for example, it was entered at onboarding), it falls back to `actual`.

### 6. `calcWindow(item, start)`: the due window
- km: `start + km − km_lower` up to `start + km + km_upper`
- date: `start + (days − days_lower)` up to `start + (days + days_upper)`

### 7. `saveProjection(p)`
Inserts the Pending `services` row and its Pending `job_cards` row in **one transaction**, so one is never saved without the other.
It also stores `rule_item_id`, so you always know which card produced the projection.

### 8. `projectService(bikeId)`: the main function
Runs steps 1–7 in order. At each step where it can't continue, it returns a clear `skipped` reason instead of throwing an error:

| skipped reason | when |
|---|---|
| Bike not found | wrong id |
| No invoice date | bike has no invoice date |
| Bike has no tag, or the tag has no rule | no rule to follow |
| Already has a pending service | an open projection exists |
| Rule finished, no more services | every card's slots are used up |
| No previous service to count from | card counts from a previous service but none has been done |

### 9. `projectTag(tagId)`
Calls `projectService` for every bike in the tag and returns one result per bike, ready to log as a table.

---

## Worked example: invoice date 1 Jan 2026

| service | card | counted from | due km | due date |
|---|---|---|---|---|
| 1st | card 1 (invoice) | 0 km on 1 Jan | 800–1,000 | 26 Jan – 5 Feb |
| 2nd | card 2 (actual) | 1st done at 950 km on 1 Feb | 2,950–3,950 | 17 Apr – 17 May |
| 3rd | card 3 (actual) | 2nd done at 3,500 km on 1 May | 8,000–9,000 | 13 Oct – 12 Nov |
| 4th–12th | card 3 again | each from the service before it | same method | |
| 13th | none | | skipped: rule finished | |

---

## Where to call them

| Event | Call |
|---|---|
| A rule is assigned to a tag | `projectTag(tagId)` |
| A bike is added to a tag that already has a rule | `projectService(bikeId)` |
| A job card is closed (after saving the Completed / Lapsed row) | `projectService(bikeId)` |

---

## Open question

**Odometer Interval (`km_interval`)** is saved on recursive cards but not used here. Repeats of card 3 use `km` (5000).
Its meaning still has to be confirmed. For example, should the 4th–12th services be 2,500 km apart instead of 5,000?
