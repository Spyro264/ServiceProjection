# Service Projection Demo — Corner Cases

This document lists the corner cases we found while building the Service Projection demo, and how the app handles each one. It also lists the cases that are **not handled yet**.

The demo is a React app. There is no backend: all data is saved in the browser's localStorage.

---

## Example rule used in this document

Most examples below use this master rule for **Activa 6G (2026)**:

| Field | Value |
|---|---|
| 1st / 2nd / 3rd service KM | 1,000 / 4,000 / 8,000 km |
| 1st / 2nd / 3rd service days | 30 / 90 / 150 days |
| Recursive KM / days | 2,500 km / 45 days |
| KM limit / day limit | 500 km / 15 days |

---

## 1. Onboarding a vehicle

### 1.1 All fields are mandatory
Reg No, Model, Company and Invoice Date must be filled. If any is empty, that field shows **"Required"** and nothing is saved.

### 1.2 Reg No written in different ways
People may type `ka 01 ab 1234` or `KA01AB1234`.
- The app turns the reg no into capitals and removes spaces before saving.
- Both examples are saved as `KA01AB1234`.

### 1.3 Same vehicle onboarded twice
If the reg no is already onboarded, the form shows **"Already onboarded"** and does not save. The check uses the cleaned-up reg no, so `KA01 AB 1234` is caught as a duplicate of `KA01AB1234`.

### 1.4 Invoice date in the future
Not allowed. The form shows **"Cannot be in the future"**.

### 1.5 No master rule for the model
A vehicle cannot be onboarded if its model has no master rule. The form shows:
> No master rule for this model. Add a rule for this model, then onboard.

Without a rule, there is nothing to project the service from.

### 1.6 Model name typed differently from the rule
The rule says `Activa 6G`, but the user types `  activa 6g `.
- Matching ignores capitals and extra spaces, so the rule is found.
- The vehicle is saved with the rule's spelling (`Activa 6G`), so the data stays consistent.

### 1.7 More than one rule for the same model
For example, there are rules for Activa 6G 2025 and Activa 6G 2026.
- The app picks the rule whose **year matches the invoice year**.
- If no year matches, it picks the **newest** rule for that model.

---

## 2. Older vehicles (invoice date more than 40 days ago)

### 2.1 Why 40 days
The 1st service is due about 15–30 days after purchase. After 40 days, the vehicle has probably had services already, so we need its history before we can project the next one.

### 2.2 Last service details are optional
If the invoice date is **more than 40 days** before today, an optional **Last Service Details** section appears on the form:
- Last Service Number
- Last Service KM
- Last Service Date

There are two ways to onboard an old vehicle:
- **Fill all three** → the next service is projected from that last service (see 2.5).
- **Leave all three empty** → the app estimates the past services from the vehicle's age (see 2.7).

If only some of the fields are filled, the form shows **"Fill all three last service fields, or leave all empty"** and nothing is saved.

### 2.3 Exactly 40 days old
A vehicle exactly 40 days old is treated as **new**. Only *more than* 40 days counts as old.

### 2.4 Checks on the last service details
| Field | Rule |
|---|---|
| Last Service Number | Whole number, 1 or more |
| Last Service KM | Number above 0 |
| Last Service Date | Not in the future, and not before the invoice date |

### 2.5 What gets saved for an old vehicle
Example: the last service was the **6th**, at 24,000 km on 01 Sep 2026.

| Service | Saved as |
|---|---|
| 1st – 5th | **No Data**: done before the vehicle was onboarded |
| 6th | **Recorded**: 24,000 km on 01 Sep 2026 |
| 7th | **Pending**: projected, and a job card is created |

The 7th is a PMS service, so it is calculated from the 6th:
24,000 + 2,500 = **26,500 – 27,000 km**, or 01 Sep + 45 days = **16 – 31 Oct 2026**.

### 2.6 Old vehicle whose last service was a free one
If the last service was the 1st or 2nd, the next one is still a **free service**. It comes from the master rule, counted from the invoice date (see 4.2), not from the last service.

Example: the last service was the 1st → the 2nd is due at **3,500 – 4,000 km**, 90 – 105 days after the invoice date.

### 2.7 Old vehicle with no service history: estimate from age
When an old vehicle is onboarded without last service details, the app works out how many services it should have had by now:
- It follows the master rule's schedule: the free services at 30, 90 and 150 days, then a PMS every 45 days (the recursive days).
- A service counts as **past** only when its whole due window (the date + day limit) has **ended** before today.
- A service whose window is still open is **not** past. It becomes the next service.
- All past services are saved as **No Data**, and the next service is projected with a job card.

Examples (today = 06 Oct 2026):
| Vehicle age | Past services (No Data) | Next service projected |
|---|---|---|
| 41 days | none | 1st (free), 500 – 1,000 km |
| 100 days | 1st | 2nd (free), 3,500 – 4,000 km |
| 160 days | 1st, 2nd | 3rd (free), 7,500 – 8,000 km |
| 365 days | 1st – 7th | 8th (PMS), 20,500 – 21,000 km |

**When the next service is free**, it comes from the master rule, counted from the invoice date, as usual.

**When the next service is PMS**, there is no real km reading. The app assumes the past services happened on the rule's schedule.
- In the 365-day example, the 7th service is assumed at 8,000 + 4 × 2,500 = **18,000 km**, on day 150 + 4 × 45 = **day 330**.
- The 8th service is then 18,000 + 2,500 = **20,500 – 21,000 km**, 45 days later.
- The service history shows that this is an estimate: *"Estimated from the vehicle's age (no service history entered)…"*

Note: the real odometer may be very different from the estimate. Entering the last service (2.5) always gives a better projection.

---

## 3. Master rules

### 3.1 All fields are mandatory
Every number must be above 0, and the year must have 4 digits.

### 3.2 KM limit default
The KM limit starts filled with **500**. The user can change it.

### 3.3 KM limit bigger than the service KM
If the KM limit is larger than the service KM (for example, limit 500 and 1st service at 300 km), the lower end of the range would be negative. The app uses **0** instead.

### 3.4 A rule changed after vehicles were onboarded
The demo has no rule editing, but a newer rule can be added for the same model.
- Every projection reads the **current** rule for the model.
- So a newer rule (for example, recursive 2,500 instead of 4,000) is used from the **next** projection onward.
- Services that are already projected keep their old values.

---

## 4. Projecting services

### 4.1 Only one service at a time
Only the next service is projected. The one after it is projected only when the current job card is closed.

### 4.2 Services 1, 2 and 3 are always free
- Free services follow a **fixed ladder from the invoice date**, using the master rule.
- They **never move**, even if an earlier service was late or lapsed.
- KM range = (service KM − KM limit) to service KM. Example: **500 – 1,000 km**.
- Date range = invoice date + service days, to that date + day limit. Example: **30 – 45 days** after the invoice date.

### 4.3 Service 4 onward is PMS
PMS is calculated from the **last actual service**, not from the plan:
- Target KM = last service KM + recursive KM. The range is target to target + KM limit.
- Target date = last service date + recursive days. The range is target to target + day limit.

Example: last service at 7,900 km on 15 Jun 2026 → next is due at **10,400 – 10,900 km** or **30 Jul – 14 Aug 2026**.

### 4.4 Due on whichever comes first
Each service has a KM range and a date range. It is due when **either one** is reached.

### 4.5 No live KM tracking in the demo
There is no odometer data in the demo. The KM range is shown as a target, and the real KM is entered by hand when the job card is closed.

---

## 5. Job cards

### 5.1 A job card for every projected service
Every time a service is projected (at onboarding, or after a job card is closed), a new job card is created as **Pending**. Numbers run `JC-0001`, `JC-0002`, and so on.

### 5.2 Pending → Ongoing
To start the service, the user must fill:
- **Days Required for Service**: number above 0 (required)
- **Service Center**: Hub, Warehouse or Service Station (required)
- **Service Items**: Oil Change and Air Filter (optional checkboxes)

### 5.3 Ongoing → closed
To close the job card, the user must enter:
- **KM Service Done At**: number above 0
- **Service Done Date**: not in the future

There is a single **Submit** button. The app decides the result.

### 5.4 Completed or Lapsed
| Situation | Result |
|---|---|
| KM within the range **and** date within the range | **Completed** |
| KM above the top of the range | **Lapsed** |
| Date after the end of the range | **Lapsed** |
| Both over | **Lapsed** (the message gives both reasons) |
| Done **early** (before the range starts) | **Completed** |

Example (due 500 – 1,000 km or 09 – 24 Apr 2026):
- 980 km on 20 Apr → Completed
- 1,300 km on 20 Apr → Lapsed (above the due KM)
- 900 km on 01 May → Lapsed (after the due date)

### 5.5 What happens when a service is completed
Service N is marked **Completed**, and service **N + 1** is projected with a new job card.

### 5.6 What happens when a service is lapsed
This is the most important corner case.
1. Service N is marked **Lapsed**. It stays lapsed forever.
2. The work that was actually done is recorded as service **N + 1**, shown as **Late Done**.
3. Service **N + 2** is projected with a new job card.

Rules we follow:
- A lapsed slot **still uses up a free slot**.
- There is no "2.1". The late work always takes the **next fresh number**.
- Slot numbers only go up and are never reused.

Example: the 1st service lapsed (done at 1,200 km on 01 Mar).
| Service | Status |
|---|---|
| 1st | Lapsed |
| 2nd | Late Done (1,200 km, 01 Mar) |
| 3rd | Pending: still the free 3rd service from the rule, 7,500 – 8,000 km |

### 5.7 Lapse at different slots
| Lapsed slot | Late work becomes | Next projected |
|---|---|---|
| 1st | 2nd (free) | 3rd: free, from the rule |
| 2nd | 3rd (free) | 4th: PMS, from the late work |
| 3rd | 4th (PMS) | 5th: PMS, from the late work |
| 4th or later | next slot (PMS) | slot after that: PMS, from the late work |

When the 2nd service lapses, the 3rd free service on the ladder is used up by the late work, so the next service is already PMS.

### 5.8 Closed job cards disappear from the page
The Job Card page has two filters: **Pending** and **Ongoing**. Completed and Lapsed job cards are still saved, but they don't show on this page. Their full story is on the vehicle's service history page.

### 5.9 Old "Open" job cards
Job cards created before the Pending/Ongoing flow had the status "Open". They are shown as **Pending**.

### 5.10 Rule missing when a job card is closed
If no master rule can be found for the vehicle when a job card is closed, the result is still saved. The next service is **not** projected, and the message says:
> Next service not projected: no master rule found for this vehicle.

---

## 6. Service history and the services table

### 6.1 One row per service slot
The `services` table has one row for each service of each vehicle. Rows are created when a service is projected, and they update as the job card moves (Pending → Ongoing → Completed or Lapsed).

### 6.2 Colours on the history page
| Status | Colour |
|---|---|
| Completed (on time) | Green |
| Late Done (work for a lapsed slot) | Orange |
| Lapsed | Red |
| Pending / Ongoing | Yellow |
| Recorded (last service of an old vehicle) | Dark grey |
| No Data (old vehicle, before onboarding) | Light grey, dashed |

### 6.3 Counts at the top of the history page
- **Completed** counts only on-time services. Late Done is counted separately.
- **Free services used** counts every slot from 1 to 3 that is already used up: Completed, Lapsed, Recorded or No Data.

### 6.4 "How it was projected"
Each projected service saves a short explanation, for example:
> PMS from the last service (7,900 km on 15 Jun 2026) + recursive 2,500 km / 45 days.

This explains why a service is due when it is, even if the rule changes later.

### 6.5 Vehicle not found
If someone opens a history link for a reg no that doesn't exist, the page shows "Vehicle … was not found" with a link back.

### 6.6 Vehicles from before the services table
Vehicles onboarded before the services table existed have an incomplete history. Fix: press **Delete** and onboard them again.

---

## 7. Data and storage

### 7.1 Tables in localStorage
| Table | Holds |
|---|---|
| `sp_vehicles` | Onboarded vehicles and their next projection |
| `mastertable` | Master rules |
| `jobcards` | Job cards |
| `services` | Service history per vehicle |
| `unplanned` | Unplanned service requests |

### 7.2 Broken or missing data
If a table is missing or its data can't be read, the app treats it as empty instead of crashing.

### 7.3 Delete button
The **Delete** button at the bottom of the sidebar:
- asks for confirmation first, so one misclick can't wipe the demo
- removes **only** the 5 tables above, so other localStorage data on the same site is not touched
- reloads the page so every screen shows empty

### 7.4 Data stays in one browser
localStorage belongs to one browser on one computer. Another person, browser or device will not see the same data. This is fine for a demo, but not for real use.

---

## 8. Unplanned service

### 8.1 The request form
The **Unplanned Projection** page has a form with:
- **Vehicle Reg No**: must be an onboarded vehicle (cleaned up the same way as onboarding, see 1.2)
- **Things to Do in This Service**: one or more items. Pick from the list, or type your own and press Enter.
- **Days Required for Service** and **Service Center**: both required

### 8.2 Critical or non-critical
- Every item in the list is **critical** (Brake Failure, Puncture Repair, Battery Replacement, …).
- Anything typed by hand is **non-critical**. Typing a list item's name (any capitals) counts as picking it.
- A request with **at least one** critical item is critical.

### 8.3 Is the planned service near?
The planned service is **near** when its Pending job card's due date starts **within 20 days** (or has already started). There is no KM check yet (see section 9).

### 8.4 What happens
| Request | Planned near | Planned not near |
|---|---|---|
| Critical | Planned is **pulled forward**: both done on one visit, when the request is accepted | Done **on its own** |
| Non-critical | **Pushed** to the planned visit: done with the planned job card | Done **on its own** |

### 8.5 Job card flow
- **On its own** or **pulled forward**: the request shows on the Job Card page as an **Unplanned** card. Pending → press **Accept** → Ongoing → enter KM + date → Completed.
- **Pulled forward**: the planned job card is hidden from the list and shown inside the unplanned card. Accepting starts it too. Closing closes both with the same KM and date. The planned service is judged as usual (done early = Completed), and the next service is projected.
- **Pushed**: no separate card. The planned job card shows "Also do on this visit". It follows the planned card: Ongoing when it starts, Completed when it closes.

### 8.6 Two records, one visit
When both are done together, the planned service is saved in `services` (marked with the unplanned number) and the unplanned one in `unplanned`. Unplanned work never moves the planned schedule.

### 8.7 More than one request for the same vehicle
- If the planned service is already pulled into another unplanned visit, a new **critical** request is done on its own.
- A new **non-critical** request is still pushed to that planned service, and rides along with the visit.
- If the planned job card is already **Ongoing**, it counts as not near, so the request is done on its own.

### 8.8 Unplanned services on the history page
The vehicle's service history page has two tabs, **Planned Services** and **Unplanned Services**, kept fully separate (own table, own counts). The top of the page shows the next planned service and any open unplanned requests side by side. Click a row in either table to see its details. A planned service done early with an unplanned request is tagged "With UP-xxxx", and the unplanned row shows which job card it was done with.

---

## 9. Not handled yet (open cases)

| Case | What happens today | Possible fix |
|---|---|---|
| Next service of an old vehicle is **already overdue** at onboarding (when the last service is entered) | It is projected anyway, with a due date in the past | Use the bucket plan: project now only if the service is in the future; otherwise wait for the next real service |
| Old vehicle with no history: the **real km** differs from the estimate | The PMS km is based on the rule's schedule, not the real odometer | Ask for the current odometer reading at onboarding |
| Existing-vehicles doc asks for the **last 2** services | Only the last 1 is asked | Add a second set of last service fields |
| Model typed with a spelling mistake | Treated as "no master rule" | Change the model field to a dropdown of rule models |
| Editing or deleting a single vehicle, rule or job card | Not possible; only "delete everything" | Add edit/delete actions |
| Seeing Completed / Lapsed job cards on the Job Card page | Hidden; only visible in service history | Add Completed and Lapsed filters |
| "Near" planned service by **KM** (100 km) | Only days are checked (no odometer) | Ask for the current KM on the unplanned form |
| Notifications, blocking, snapshot screen | Not built | Planned for later modules |
