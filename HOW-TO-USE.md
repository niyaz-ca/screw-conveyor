# Screw Conveyor Estimator — how to use

Preliminary design, fabrication BOQ and cost estimate for screw conveyors.
For budgeting and enquiry stage only (±20–25 %). It is not a final design.

## Opening it

Double-click **`index.html`** in this `app` folder. It opens in Edge or Chrome.
You don't need to install anything or be online.

To share it with your team, zip the whole `app` folder and send it. Each person unzips it and double-clicks `index.html`.

## The two tabs

### 1 Design
Your inputs are on the left. Live results are on the right, and they update as you type.

- **Duty** is always open. Pick the material, then enter capacity (t/h), length and incline. Screw diameter, trough type and materials are here too. For a quick estimate, this is all you need to fill in.
- The other sections are folded. Click a heading to open one. When folded, each heading shows a one-line summary of its current values.
  - *Material properties*: density, loading class, Fm, λ, lump size. These are filled in automatically when you pick a material.
  - *Screw, shaft, hangers & drive*: everything here is on *Auto* by default.
  - *Construction details*: thicknesses, spouts, legs, bearings, seals, paint.
  - *Optional extras*: VFD, switches, gates, installation, and so on.
  - *Project details*: client, tag, date. Used on the printout.
- The right side shows diameter, speed, motor, shaft and pipe, hangers, weight, the **selling price**, a sketch and the design checks. Open *Calculation details* to see every intermediate value.

The **status box** is green when the design passes every check. It turns orange when there are notes to read, and red when the design is not acceptable.

### 2 BOQ & cost
- **All-in rates (material + labour)**, shown right above the table. There's one AED/kg rate for each group:
  - **Screw:** flights and centre pipe.
  - **Machined parts:** shafts and bushings, machining included.
  - **Trough & casing:** trough, covers, end plates, flanges, spouts, hanger brackets.
  - **Supports & drive:** saddles, legs, drive base, guards.

  Change a rate and every line reprices at once.
- **One simple table:** Item · Qty · Unit · Weight kg · Rate · Amount, with a subtotal for each group.
  - Fabricated lines: amount = weight × all-in rate.
  - Stainless, Hardox and EN19 parts: the rate is multiplied by the factor set in *Other rates & prices*.
  - To use your own price for any line, type it in the Amount box. Clear the box to go back.
- **Price build-up:** set overhead, contingency and profit % directly here.
- **Other rates & prices** (folded): currency, SS/Hardox factors, painting per m², assembly rate, motor price formula, bolts, gaskets. Set them once. They are kept for every project.

The raw-material purchase list (stock sizes and buy weights including wastage) is not shown on screen. It is included in **Export Excel**.

Which sections you leave open or folded is remembered.

## Saving, printing, Excel

- **Save** keeps the project in this browser. **Open** lists saved projects.
- In the Open box, use **Download** or **Download all projects** to keep a backup file. That file can also be emailed to a colleague, who loads it with **Import file…**.
- **Print / PDF** prints the datasheet, sketch, BOQ and price build-up. To send a PDF, pick "Save as PDF" in the print dialog. To print without prices, untick *Include prices when printing* on the BOQ & cost tab.
- **Export Excel** downloads a formatted workbook (`BOQ_<project>_<tag>.xlsx`) with three sheets:
  - **BOQ**: project summary, then the yellow **rate cells** (four all-in AED/kg rates, overhead, contingency, profit, quantity), then the item table and the price build-up. Every amount is a live formula, so **change a yellow cell in Excel and the whole sheet recalculates**. Bought-out unit prices are yellow too. Lines you priced by hand in the app are marked *[price fixed by estimator]*.
  - **Purchase list**: stock sizes, length, net kg, wastage % and buy kg. This sheet is for purchasing.
  - **Design**: duty, screw, speed and power, construction, and all the design checks.

> Projects are saved inside the browser on this PC. Clearing the browser history can delete them, so download a backup file regularly.

## How the numbers are calculated

| Item | Method | Source |
|---|---|---|
| Capacity and speed | Volume per revolution = π/4·(D² − d²)·pitch·fill. Max speed by loading class. Capacity factors for cut flights, ribbon flights and paddles | CEMA Table C, D (Conveyor Eng. catalog p.16–17) |
| Incline | Capacity reduced with angle, same curve as the J&H calculator | J&H |
| Power (main) | HP = (HPf + HPm)·Fo / e, plus lift | CEMA p.19–22, Tables H, J, K, L, M |
| Power (cross-check) | P = Q·(λ·L + H)/367 + D·L/20 | DIN 15262, which is the J&H method |
| Motor | Next IEC size above the higher of the two, plus your margin | — |
| Shaft and pipe | Full motor torque at screw speed against allowable shear (shaft ≈ 28 MPa, alloy ≈ 39 MPa, pipe ≈ 45 MPa) | Back-calculated from CEMA Table Q |
| Hangers | Screw split into sections no longer than the max one-piece length. Hangers are added until the sag (5wL⁴/384EI) is within limit: 1 % of D (J&H) or 3.8 mm (CEMA) | J&H / CEMA Table R |
| Lumps | Radial clearance ÷ class ratio | CEMA Table E |
| Flight weight | Exact helicoid area × thickness × 1.10 forming allowance | Checked against catalog p.34 |
| Trough weight | Developed width = πA/2 + 2B + 2C, using CEMA trough dimensions | Checked against catalog p.47 |

The **Calculation details** box on the Design tab shows every intermediate value, so you can check a result by hand or against J&H.

### Comparing with J&H

Speed, volume capacity and power match J&H exactly when the inputs are the same (see `tests.html`). Three differences are intentional:

1. **Motor size is the larger of CEMA and J&H**. CEMA adds an overload factor for small drives, so it is usually the larger.
2. **Inclined screws.** The J&H web tool multiplies the lift by the length, L·(λ + H). That looks like an error in their script. This app uses the DIN form, λ·L + H. *Calculation details* shows "J&H calculator would show …" so you can still compare.
3. **Deflection is about 10 % lower than J&H.** J&H overestimates the flight weight. This app uses the exact flight area, which matches the catalog screw weights.

## Checking it still works

Open **`tests.html`**. It runs 27 checks against J&H, the CEMA worked example and catalog weights. Every row should say **PASS**. Run it again after anyone changes the formulas.

## Limits — when to get a detailed design

- Vertical screws (> 45°), feeder screws (flood-loaded inlets), live-bottom bins and screw presses are not covered.
- Materials that are sticky, hot (> 200 °C), explosive or food-grade (needing a polished finish) need specialist review.
- Bought-out prices (motor, bearings, extras) are budget formulas. Replace them with vendor quotes for a firm offer.
- The material library holds typical values. Use your client's test data when you have it.

## Files

```
app/
  index.html      ← open this
  tests.html      ← verification checks
  css/app.css     ← look and feel
  js/data.js      ← tables: materials, sizes, pipes, CEMA factors, default rates
  js/engine.js    ← all calculations (design, BOQ, costing)
  js/ui.js        ← screens, saving, printing
  js/xlsx.js      ← Excel file writer (no internet or add-ins needed)
  js/export.js    ← what goes into the Excel BOQ
```

To add a material or change a default, edit `js/data.js`. The comments in the file say what each number is. Or ask Claude Code to do it.
