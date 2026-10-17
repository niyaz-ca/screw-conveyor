/* =====================================================================
   SCREW CONVEYOR ESTIMATOR — reference data
   Sources:
     [CEMA]  Conveyor Eng. & Mfg. "Screw Conveyor Components & Design" v2.20
             (CEMA 350 method) — Tables C, D, E, G, H, J, K, L, M, N, Q, R, S
             and trough dimension tables p.47–48.
     [J&H]   J&H Bulk-handling calculator (jh.nl) — DIN 15262 power method,
             incline correction, power factor λ per product, deflection rule.
   All values are typical / preliminary. Every value is editable in the app.
   ===================================================================== */
window.SC = window.SC || {};

SC.DATA = {

  /* ---------------- Bulk materials ----------------------------------
     rho  : bulk density as conveyed, kg/m³
     load : CEMA trough loading class  '15' | '30A' | '30B' | '45'
     fm   : CEMA material factor Fm (Table B)
     lam  : J&H / DIN 15262 power factor λ
     abr  : 0 = non-abrasive, 1 = mildly abrasive, 2 = abrasive          */
  materials: [
    { g:'Cement, Lime & Minerals', key:'cement',        name:'Cement, Portland (settled)',   rho:1500, load:'30B', fm:1.4, lam:3.0, abr:1 },
    { g:'Cement, Lime & Minerals', key:'cement_aer',    name:'Cement, aerated',              rho:1100, load:'30B', fm:1.4, lam:3.0, abr:1 },
    { g:'Cement, Lime & Minerals', key:'clinker',       name:'Cement clinker',               rho:1360, load:'15',  fm:1.8, lam:4.0, abr:2 },
    { g:'Cement, Lime & Minerals', key:'fly_ash',       name:'Fly ash',                      rho:700,  load:'30B', fm:2.0, lam:5.0, abr:2 },
    { g:'Cement, Lime & Minerals', key:'ash_dry',       name:'Ashes, coal, dry',             rho:600,  load:'15',  fm:3.0, lam:4.0, abr:2 },
    { g:'Cement, Lime & Minerals', key:'lime_hyd',      name:'Lime, hydrated',               rho:640,  load:'30A', fm:0.8, lam:2.5, abr:0 },
    { g:'Cement, Lime & Minerals', key:'lime_pebble',   name:'Lime, pebble / quick',         rho:880,  load:'30B', fm:2.0, lam:3.0, abr:1 },
    { g:'Cement, Lime & Minerals', key:'limestone_dust',name:'Limestone dust / flour',       rho:1200, load:'30B', fm:1.8, lam:3.4, abr:2 },
    { g:'Cement, Lime & Minerals', key:'limestone',     name:'Limestone, crushed',           rho:1400, load:'15',  fm:2.0, lam:4.0, abr:2 },
    { g:'Cement, Lime & Minerals', key:'gypsum_pwd',    name:'Gypsum, calcined powder',      rho:1100, load:'30B', fm:2.0, lam:2.8, abr:1 },
    { g:'Cement, Lime & Minerals', key:'gypsum_raw',    name:'Gypsum, raw crushed',          rho:1250, load:'15',  fm:2.0, lam:4.0, abr:2 },
    { g:'Cement, Lime & Minerals', key:'dolomite',      name:'Dolomite, crushed',            rho:1440, load:'15',  fm:2.0, lam:4.0, abr:2 },
    { g:'Cement, Lime & Minerals', key:'kaolin',        name:'Kaolin clay',                  rho:1010, load:'30B', fm:2.0, lam:3.0, abr:1 },
    { g:'Cement, Lime & Minerals', key:'bentonite',     name:'Bentonite',                    rho:880,  load:'30B', fm:0.7, lam:2.8, abr:1 },
    { g:'Cement, Lime & Minerals', key:'talc',          name:'Talc powder',                  rho:800,  load:'30A', fm:0.8, lam:2.8, abr:1 },
    { g:'Cement, Lime & Minerals', key:'clay_calc',     name:'Clay, calcined',               rho:1440, load:'15',  fm:2.4, lam:4.0, abr:2 },

    { g:'Aggregates & Ores',       key:'sand_dry',      name:'Sand, dry silica',             rho:1600, load:'15',  fm:1.7, lam:5.0, abr:2 },
    { g:'Aggregates & Ores',       key:'sand_wet',      name:'Sand, damp',                   rho:1900, load:'15',  fm:2.8, lam:4.0, abr:2 },
    { g:'Aggregates & Ores',       key:'gravel',        name:'Gravel, dry',                  rho:1500, load:'15',  fm:2.0, lam:5.0, abr:2 },
    { g:'Aggregates & Ores',       key:'alumina',       name:'Alumina',                      rho:960,  load:'15',  fm:1.8, lam:4.0, abr:2 },
    { g:'Aggregates & Ores',       key:'bauxite',       name:'Bauxite, crushed',             rho:1280, load:'15',  fm:1.8, lam:4.0, abr:2 },
    { g:'Aggregates & Ores',       key:'iron_ore',      name:'Iron ore, fines',              rho:2400, load:'15',  fm:2.2, lam:3.8, abr:2 },
    { g:'Aggregates & Ores',       key:'slag',          name:'Slag, granulated',             rho:1000, load:'15',  fm:2.2, lam:4.0, abr:2 },
    { g:'Aggregates & Ores',       key:'phosphate',     name:'Phosphate rock, pulverised',   rho:960,  load:'30B', fm:1.7, lam:3.8, abr:2 },
    { g:'Aggregates & Ores',       key:'glass_batch',   name:'Glass batch',                  rho:1440, load:'15',  fm:2.5, lam:4.5, abr:2 },

    { g:'Coal & Carbon',           key:'coal_bit',      name:'Coal, bituminous ≤ 12 mm',     rho:750,  load:'30A', fm:0.9, lam:3.0, abr:1 },
    { g:'Coal & Carbon',           key:'coal_pulv',     name:'Coal, pulverised',             rho:560,  load:'30A', fm:0.6, lam:2.3, abr:1 },
    { g:'Coal & Carbon',           key:'petcoke',       name:'Petroleum coke, calcined',     rho:640,  load:'15',  fm:1.3, lam:3.0, abr:2 },
    { g:'Coal & Carbon',           key:'carbon_black',  name:'Carbon black, pellets',        rho:360,  load:'30A', fm:0.8, lam:2.3, abr:0 },

    { g:'Grain & Food',            key:'wheat',         name:'Wheat',                        rho:750,  load:'45',  fm:0.4, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'corn',          name:'Corn, shelled',                rho:720,  load:'45',  fm:0.4, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'barley',        name:'Barley',                       rho:670,  load:'45',  fm:0.4, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'rice',          name:'Rice, hulled',                 rho:750,  load:'45',  fm:0.4, lam:2.0, abr:0 },
    { g:'Grain & Food',            key:'flour',         name:'Flour, wheat',                 rho:590,  load:'30A', fm:0.6, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'sugar',         name:'Sugar, granulated',            rho:850,  load:'30B', fm:1.0, lam:6.5, abr:1 },
    { g:'Grain & Food',            key:'salt',          name:'Salt, dry fine',               rho:1200, load:'30B', fm:1.7, lam:6.0, abr:2 },
    { g:'Grain & Food',            key:'soymeal',       name:'Soybean meal',                 rho:640,  load:'30A', fm:0.5, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'bran',          name:'Bran',                         rho:290,  load:'45',  fm:0.5, lam:2.5, abr:0 },
    { g:'Grain & Food',            key:'feed',          name:'Animal feed, mash',            rho:550,  load:'30A', fm:0.6, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'milk_powder',   name:'Milk powder',                  rho:500,  load:'30A', fm:0.5, lam:3.2, abr:0 },
    { g:'Grain & Food',            key:'coffee',        name:'Coffee, green beans',          rho:560,  load:'45',  fm:0.5, lam:2.3, abr:0 },
    { g:'Grain & Food',            key:'starch',        name:'Starch',                       rho:640,  load:'30A', fm:1.0, lam:2.8, abr:0 },

    { g:'Chemicals & Plastics',    key:'soda_light',    name:'Soda ash, light',              rho:450,  load:'30B', fm:0.8, lam:4.0, abr:1 },
    { g:'Chemicals & Plastics',    key:'soda_dense',    name:'Soda ash, dense',              rho:960,  load:'30B', fm:1.0, lam:3.4, abr:1 },
    { g:'Chemicals & Plastics',    key:'urea',          name:'Urea prills',                  rho:720,  load:'30A', fm:1.2, lam:4.0, abr:1 },
    { g:'Chemicals & Plastics',    key:'amm_sulph',     name:'Ammonium sulphate',            rho:830,  load:'30B', fm:1.0, lam:3.4, abr:1 },
    { g:'Chemicals & Plastics',    key:'fertilizer',    name:'Fertiliser, granular NPK',     rho:1000, load:'30B', fm:1.2, lam:3.4, abr:1 },
    { g:'Chemicals & Plastics',    key:'pvc_powder',    name:'PVC powder',                   rho:450,  load:'30A', fm:1.0, lam:2.8, abr:0 },
    { g:'Chemicals & Plastics',    key:'pellets',       name:'Plastic pellets (PE/PP)',      rho:520,  load:'45',  fm:0.4, lam:2.0, abr:0 },
    { g:'Chemicals & Plastics',    key:'detergent',     name:'Detergent / soap powder',      rho:500,  load:'30A', fm:0.8, lam:2.5, abr:0 },
    { g:'Chemicals & Plastics',    key:'borax',         name:'Borax',                        rho:970,  load:'30B', fm:0.7, lam:1.0, abr:1 },

    { g:'Wood, Bio & Waste',       key:'sawdust',       name:'Sawdust, dry',                 rho:210,  load:'45',  fm:0.7, lam:2.8, abr:0 },
    { g:'Wood, Bio & Waste',       key:'wood_chips',    name:'Wood chips',                   rho:350,  load:'45',  fm:0.6, lam:2.8, abr:0 },
    { g:'Wood, Bio & Waste',       key:'wood_pellets',  name:'Wood pellets',                 rho:650,  load:'30A', fm:0.8, lam:3.0, abr:1 },
    { g:'Wood, Bio & Waste',       key:'rice_husk',     name:'Rice husk',                    rho:120,  load:'45',  fm:0.4, lam:2.3, abr:1 },
    { g:'Wood, Bio & Waste',       key:'bagasse',       name:'Bagasse',                      rho:130,  load:'30A', fm:1.5, lam:3.0, abr:0 },
    { g:'Wood, Bio & Waste',       key:'compost',       name:'Compost',                      rho:500,  load:'30A', fm:1.0, lam:3.0, abr:1 },
    { g:'Wood, Bio & Waste',       key:'sludge_dry',    name:'Sewage sludge, dried',         rho:720,  load:'30A', fm:0.8, lam:2.8, abr:1 },
    { g:'Wood, Bio & Waste',       key:'sludge_cake',   name:'Sewage sludge, dewatered cake',rho:1050, load:'30B', fm:1.5, lam:5.0, abr:1 }
  ],

  /* CEMA trough loading classes (Table D) */
  loadClasses: {
    '15':  { fill:0.15, label:'15 %  — very abrasive / heavy (class 3)' },
    '30A': { fill:0.30, label:'30 % A — light, free-flowing, non-abrasive' },
    '30B': { fill:0.30, label:'30 % B — mildly abrasive (lower speed)' },
    '45':  { fill:0.45, label:'45 %  — light, free-flowing, non-abrasive (grain)' }
  },

  /* CEMA Table D: maximum recommended rpm by screw dia (inch) and loading */
  maxRpm: {
    dia:  [6,   9,   12,  14,  16,  18,  20,  24,  30, 36],
    '15': [60,  55,  50,  50,  45,  45,  40,  40,  30, 20],
    '30A':[120, 100, 90,  85,  80,  75,  70,  65,  50, 35],
    '30B':[60,  55,  50,  47,  44,  41,  38,  36,  27, 19],
    '45': [165, 155, 145, 140, 130, 120, 110, 100, 70, 40]
  },

  /* CEMA Table L: diameter HP factor Fd */
  Fd: { dia:[6,9,10,12,14,16,18,20,24,30,36,42,48], val:[18,31,37,55,78,106,135,165,235,360,512,720,940] },

  /* CEMA Table C (CF2) and Table J (Ff) — flight types, by loading 15/30/45/95 % */
  flights: {
    std:     { label:'Standard (solid) flight', cf2:[1.00,1.00,1.00,1.00], ff:[1.00,1.00,1.00,1.00], wt:1.00 },
    cut:     { label:'Cut flight',              cf2:[1.95,1.57,1.43,1.43], ff:[1.10,1.15,1.20,1.30], wt:0.85 },
    cutfold: { label:'Cut & folded flight',     cf2:[3.75,3.75,2.54,2.54], ff:[1.50,1.50,1.70,2.20], wt:0.95 },
    ribbon:  { label:'Ribbon flight',           cf2:[1.04,1.37,1.62,1.62], ff:[1.05,1.14,1.20,1.20], wt:0.50 }
  },
  /* CEMA Table C (CF3) and Table K (Fp): paddles per pitch 0..4 */
  paddles: { cf3:[1.00,1.08,1.16,1.24,1.32], fp:[1.00,1.29,1.58,1.87,2.16] },

  /* Pitch options (pitch / diameter) */
  pitches: {
    full:  { ratio:1.0,   label:'Full pitch (P = D)' },
    short: { ratio:2/3,   label:'Short pitch (P = ⅔ D)' },
    half:  { ratio:0.5,   label:'Half pitch (P = ½ D)' },
    long:  { ratio:1.5,   label:'Long pitch (P = 1½ D)' }
  },

  /* CEMA Table M: hanger bearing factor Fb */
  hangerBearings: {
    ball:     { label:'Ball bearing (sealed)',            fb:1.0, price:420 },
    bronze:   { label:'Bronze / oil-impregnated bush',     fb:1.7, price:280 },
    uhmw:     { label:'UHMW / nylon bush',                 fb:2.0, price:220 },
    hardiron: { label:'Hard iron / Stellite (abrasive)',   fb:4.4, price:380 }
  },

  /* CEMA Table G1: complete drive efficiency */
  drives: {
    gm_direct: { label:'Geared motor, direct coupled (in-line)',  eff:0.94 },
    gm_shaft:  { label:'Shaft-mounted geared motor (hollow shaft)',eff:0.94 },
    smr_belt:  { label:'Shaft-mount reducer + V-belt',            eff:0.88 },
    gm_chain:  { label:'Geared motor + chain & sprockets',        eff:0.85 }
  },

  /* IEC standard motor sizes, kW */
  motorsKw: [0.37,0.55,0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200],

  /* ---------------- Standard screw sizes (metric) --------------------
     Defaults for a standard-duty carbon-steel sectional screw, based on
     CEMA Table N (standard duty) converted to practical metric stock.
     D mm | pipe | shaft mm | flight t | trough t | cover t | end plate t  */
  sizes: [
    { D:150, pipe:'p2_40',    shaft:40,  tFl:3,  tTr:3, tCv:2, tEnd:8  },
    { D:200, pipe:'p25_40',   shaft:50,  tFl:4,  tTr:3, tCv:2, tEnd:8  },
    { D:250, pipe:'p3_40',    shaft:50,  tFl:4,  tTr:4, tCv:2, tEnd:10 },
    { D:300, pipe:'p3_40',    shaft:60,  tFl:5,  tTr:5, tCv:3, tEnd:10 },
    { D:350, pipe:'p4_40',    shaft:75,  tFl:5,  tTr:5, tCv:3, tEnd:12 },
    { D:400, pipe:'p4_40',    shaft:75,  tFl:6,  tTr:5, tCv:3, tEnd:12 },
    { D:450, pipe:'p5_40',    shaft:90,  tFl:6,  tTr:6, tCv:3, tEnd:12 },
    { D:500, pipe:'p5_40',    shaft:90,  tFl:6,  tTr:6, tCv:3, tEnd:12 },
    { D:600, pipe:'p6_40',    shaft:100, tFl:8,  tTr:6, tCv:3, tEnd:16 },
    { D:700, pipe:'p8_40',    shaft:110, tFl:8,  tTr:8, tCv:4, tEnd:16 },
    { D:800, pipe:'p8_40',    shaft:125, tFl:10, tTr:8, tCv:4, tEnd:20 }
  ],

  /* CEMA U-trough geometry (p.47): side height above screw centre-line B,
     and top flange width C, by screw dia (inch → mm). Interpolated. */
  troughB: { dia:[6,9,10,12,14,16,18,20,24,30,36], B:[114,156,162,197,235,270,308,343,419,502,610], C:[32,38,38,51,51,51,64,64,64,76,76] },

  /* Centre pipe library — ASME B36.10 and EN 10220 (OD × wall, mm) */
  pipes: {
    p2_40:   { od:60.3,  t:3.91,  label:'2" NB Sch 40' },
    p2_80:   { od:60.3,  t:5.54,  label:'2" NB Sch 80' },
    p25_40:  { od:73.0,  t:5.16,  label:'2½" NB Sch 40' },
    p25_80:  { od:73.0,  t:7.01,  label:'2½" NB Sch 80' },
    p3_40:   { od:88.9,  t:5.49,  label:'3" NB Sch 40' },
    p3_80:   { od:88.9,  t:7.62,  label:'3" NB Sch 80' },
    p35_40:  { od:101.6, t:5.74,  label:'3½" NB Sch 40' },
    p4_40:   { od:114.3, t:6.02,  label:'4" NB Sch 40' },
    p4_80:   { od:114.3, t:8.56,  label:'4" NB Sch 80' },
    e139_5:  { od:139.7, t:5.0,   label:'EN 139.7 × 5.0' },
    p5_40:   { od:141.3, t:6.55,  label:'5" NB Sch 40' },
    p5_80:   { od:141.3, t:9.53,  label:'5" NB Sch 80' },
    e168_56: { od:168.3, t:5.6,   label:'EN 168.3 × 5.6' },
    p6_40:   { od:168.3, t:7.11,  label:'6" NB Sch 40' },
    p6_80:   { od:168.3, t:10.97, label:'6" NB Sch 80' },
    e219_63: { od:219.1, t:6.3,   label:'EN 219.1 × 6.3' },
    p8_40:   { od:219.1, t:8.18,  label:'8" NB Sch 40' },
    p8_80:   { od:219.1, t:12.7,  label:'8" NB Sch 80' },
    e273_63: { od:273.0, t:6.3,   label:'EN 273.0 × 6.3' },
    p10_40:  { od:273.0, t:9.27,  label:'10" NB Sch 40' },
    e323_8:  { od:323.9, t:8.0,   label:'EN 323.9 × 8.0' },
    p12_40:  { od:323.9, t:10.31, label:'12" NB Sch 40' }
  },

  /* Standard round-bar shaft sizes, mm */
  shafts: [40,50,60,65,75,90,100,110,125,140,160],

  /* Shaft material: allowable shear stress for coupling shafts with bolt
     holes. Back-calculated from CEMA Table Q (1018/SS ≈ 28 MPa,
     4140 ≈ 39 MPa on gross section). */
  shaftMats: {
    C45:   { label:'C45 / EN8 (carbon steel)',   tau:28, rho:7850, mult:1.15 },
    EN19:  { label:'EN19 / 42CrMo4 (alloy)',     tau:39, rho:7850, mult:1.6  },
    SS304: { label:'SS 304',                     tau:28, rho:7930, mult:3.8  },
    SS316: { label:'SS 316',                     tau:28, rho:7980, mult:4.8  }
  },
  pipeTau: 45,      // MPa — centre pipe allowable torsional shear (CEMA Table Q back-calc)

  /* Plate / pipe materials of construction.
     mult = purchase price multiplier on carbon-steel rate
     lab  = fabrication labour multiplier (welding / handling) */
  mocs: {
    MS:     { label:'Carbon steel (S275 / IS2062)', rho:7850, mult:1.0, lab:1.0,  paint:true  },
    SS304:  { label:'Stainless steel 304',          rho:7930, mult:3.6, lab:1.5,  paint:false },
    SS316:  { label:'Stainless steel 316',          rho:7980, mult:4.6, lab:1.5,  paint:false },
    HARDOX: { label:'Wear plate (Hardox 400)',      rho:7850, mult:2.4, lab:1.35, paint:true  }
  },

  /* Lump classes — CEMA Table E class ratio */
  lumpClasses: {
    1: { ratio:1.75, label:'Class 1 — ≤10 % lumps (mostly fines)' },
    2: { ratio:2.50, label:'Class 2 — ≤25 % lumps' },
    3: { ratio:4.50, label:'Class 3 — ≥95 % lumps' }
  },

  troughTypes: {
    U:      { label:'U-trough, formed flange (standard)' },
    flared: { label:'Flared trough (for bridging materials)' },
    tube:   { label:'Tubular housing (incline / dust-tight)' }
  },

  flightFabs: {
    sectional: { label:'Sectional (cut & pressed from plate)', wt:1.10, lab:1.6 },
    helicoid:  { label:'Helicoid (cold-rolled, ≤ 400 mm)',     wt:0.80, lab:1.0 }
  },

  seals: {
    plate:  { label:'Plate seal / dust seal',      price:120 },
    gland:  { label:'Packing gland',               price:250 },
    split:  { label:'Split gland / waste pack',    price:380 },
    purge:  { label:'Air-purged seal',             price:900 }
  },

  endBearings: {
    flange:  { label:'Flanged ball bearing unit (UCF)', price:220 },
    plummer: { label:'Plummer block (SN + spherical roller)', price:450 }
  },

  /* Angle used for trough joint / end flanges by screw dia (kg/m) */
  angles: [
    { maxD:250,  spec:'L 40×40×5', kgm:2.97 },
    { maxD:400,  spec:'L 50×50×6', kgm:4.47 },
    { maxD:600,  spec:'L 65×65×6', kgm:5.91 },
    { maxD:9999, spec:'L 75×75×8', kgm:8.99 }
  ],
  /* Support leg section by screw dia (kg/m) */
  legs: [
    { maxD:400,  spec:'C 100 channel', kgm:10.6 },
    { maxD:600,  spec:'C 150 channel', kgm:17.9 },
    { maxD:9999, spec:'C 200 channel', kgm:25.3 }
  ],

  /* Optional extras — user ticks what is in scope */
  /* budget price = base + perKw × motor kW (editable per project) */
  extras: [
    { key:'vfd',      label:'Variable frequency drive (VFD)',     base:1200, perKw:180 },
    { key:'zss',      label:'Zero-speed / rotation switch',       base:650,  perKw:0 },
    { key:'plug',     label:'Plugged-chute (blockage) switch',    base:700,  perKw:0 },
    { key:'insp',     label:'Inspection / clean-out door',        base:350,  perKw:0 },
    { key:'gate',     label:'Slide gate at outlet (manual)',      base:1200, perKw:0 },
    { key:'panel',    label:'Local control panel / starter',      base:1800, perKw:150 },
    { key:'tpi',      label:'Third-party inspection',             base:1500, perKw:0 },
    { key:'install',  label:'Site installation & commissioning',  base:2500, perKw:0 }
  ],

  currencies: ['AED','SAR','QAR','OMR','KWD','BHD','USD','EUR','GBP','INR']
};

/* Default commercial rates. Saved separately so they persist between projects. */
SC.DEFAULT_RATES = {
  currency: 'AED',
  /* All-in rates per kg of finished (net) weight = material + labour, carbon steel */
  rScrew: 10,          // screw: flights + centre pipe
  rMach: 25,           // machined parts: shafts + bushings (includes machining)
  rTrough: 8,          // trough, covers, end plates, flanges, spouts, hanger brackets
  rStruct: 7,          // supports, drive base, guards, misc. steel
  /* Multiplier on the all-in rate for other materials */
  fSS304: 2.6, fSS316: 3.2, fHARDOX: 1.7, fEN19: 1.25,
  shopHr: 120,         // shop assembly & test run, per hour
  paint: 30,           // surface prep + 2-coat paint per m²
  pickle: 18,          // pickling & passivation (stainless) per m²
  motorA: 1500,        // geared motor budget price = A + B × kW
  motorB: 420,
  bolt: 2.5,           // per bolt set (bolt + nut + washer, Gr 8.8 HDG)
  gasket: 15,          // per metre
  overhead: 10,        // % on direct cost
  contingency: 5,      // %
  profit: 15,          // %
  wPlate: 10,          // wastage % — plates, sheets, sections
  wFlight: 25,         // wastage % — flight blanks (annulus cut from square)
  wPipe: 5,            // wastage % — pipe
  wBar: 10             // wastage % — round bar
};
