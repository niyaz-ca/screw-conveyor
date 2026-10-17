/* =====================================================================
   SCREW CONVEYOR ESTIMATOR — calculation engine (no UI code here)

   SC.design(inp)            → design results R (speed, power, torque,
                               deflection, hangers, checks)
   SC.boq(inp, R, rates)     → fabrication BOQ, bought-outs, services,
                               raw-material take-off
   SC.cost(B, inp, rates)    → priced lines and commercial summary

   Method
   ------
   Capacity / speed  : geometric volume per revolution with CEMA fill
                       classes and capacity factors (CF2, CF3); max speed
                       from CEMA Table D; incline correction as J&H.
   Power (primary)   : CEMA 350  HP = (HPf + HPm)·Fo/e  + lift.
   Power (check)     : DIN 15262 / J&H  P = Q(λ·Lh + H)/367 + D·L/20.
   Motor             : next IEC size above max(CEMA, DIN/e) × (1+margin).
   Torque            : full motor torque at screw speed (CEMA practice),
                       checked against shaft and pipe allowables.
   Deflection        : 5wL⁴/384EI of pipe + flights per screw section;
                       hangers added until within limit (J&H 1 %·D, or CEMA).
   ===================================================================== */
(function(){
  const D_ = SC.DATA;
  const RHO_STEEL = 7850, G = 9.81, E_STEEL = 200e9;

  /* ---------- helpers ---------- */
  const num = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : d; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function interp(xs, ys, x){
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++){
      if (x <= xs[i]) return ys[i-1] + (ys[i]-ys[i-1]) * (x - xs[i-1]) / (xs[i]-xs[i-1]);
    }
    return ys[ys.length-1];
  }
  const loadIdx = load => load === '15' ? 0 : (load === '45' ? 2 : 1);   // index into 15/30/45/95 tables
  const sizeRow = D => D_.sizes.find(s => s.D >= D) || D_.sizes[D_.sizes.length-1];
  // od / t stay in mm on the pipe object; geometry below is in metres
  const pipeGeom = p => { const od = p.od/1000, id = (p.od - 2*p.t)/1000;
    return { odm:od, idm:id, I: Math.PI/64*(od**4 - id**4), J: Math.PI/32*(od**4 - id**4),
             A: Math.PI/4*(od*od - id*id) }; };
  const pipeList = () => Object.entries(D_.pipes).map(([k,p]) => Object.assign({key:k}, p, pipeGeom(p)))
                                                 .sort((a,b) => a.A - b.A);
  const nextMotor = kw => D_.motorsKw.find(m => m >= kw - 1e-9) || D_.motorsKw[D_.motorsKw.length-1];

  /* Area of one pitch of a helicoid flight, inner radius ri to outer ro (m²).
     Exact integral of √((2πr)² + P²) dr. */
  function helicoidArea(ro, ri, P){
    const a = 2*Math.PI;
    const F = r => { const u = a*r, s = Math.sqrt(u*u + P*P); return (u*s/2 + (P*P/2)*Math.log(u + s)) / a; };
    return F(ro) - F(ri);
  }

  /* J&H incline correction on capacity */
  function inclineFactor(theta, pitchRatio, trough){
    if (theta <= 0) return 1;
    if (pitchRatio >= 0.75){                       // full pitch, U or tube
      if (theta <= 10) return 1 - theta*0.01;
      if (theta <= 15) return 0.9 - (theta-10)*0.04;
      if (theta <= 30) return 0.7 - (theta-15)*0.4/15;
      return Math.max(0.05, 0.3 - (theta-30)*0.2/15);
    }
    if (trough === 'tube'){                        // half pitch, tubular
      return theta <= 25 ? 1 : Math.max(0.05, 1 - (theta-25)*0.65/20);
    }
    if (theta <= 15) return 1;                     // half pitch, U-trough
    if (theta <= 30) return 1 - (theta-15)*0.5/15;
    return Math.max(0.05, 0.5 - (theta-30)*0.3/15);
  }

  const maxRpmFor = (load, Dmm) => interp(D_.maxRpm.dia, D_.maxRpm[load] || D_.maxRpm['30A'], Dmm/25.4);

  /* =================================================================
     DESIGN
     ================================================================= */
  SC.design = function(inp){
    const mat = {
      rho: num(inp.rho, 800), fm: num(inp.fm, 1), lam: num(inp.lam, 2.5), abr: num(inp.abr, 0),
      load: D_.loadClasses[inp.load] ? inp.load : '30A'
    };
    const fill = num(inp.fillPct, NaN) > 0 ? num(inp.fillPct)/100 : D_.loadClasses[mat.load].fill;
    const Qt = Math.max(0, num(inp.tph, 0));                  // t/h
    const Qv = mat.rho > 0 ? Qt*1000/mat.rho : 0;             // m³/h
    const L = Math.max(0.5, num(inp.L, 6));                   // overall length, m
    const theta = clamp(num(inp.angle, 0), 0, 90);
    const H = L*Math.sin(theta*Math.PI/180), Lh = L*Math.cos(theta*Math.PI/180);
    const Lscrew = Math.max(0.3, L - 0.05);
    const flt = D_.flights[inp.flight] || D_.flights.std;
    const pad = clamp(Math.round(num(inp.paddles, 0)), 0, 4);
    const fab = D_.flightFabs[inp.flightFab] || D_.flightFabs.sectional;
    const li = loadIdx(mat.load);
    const pitchRatio = inp.pitchType === 'custom' ? null : (D_.pitches[inp.pitchType] || D_.pitches.full).ratio;
    const lumpRatio = (D_.lumpClasses[inp.lumpClass] || D_.lumpClasses[1]).ratio;
    const lump = Math.max(0, num(inp.lump, 0));
    const mocS = D_.mocs[inp.mocScrew] || D_.mocs.MS;
    const sMat = D_.shaftMats[inp.shaftMat] || D_.shaftMats.C45;
    const hb = D_.hangerBearings[inp.hangerType] || D_.hangerBearings.bronze;
    const drive = D_.drives[inp.drive] || D_.drives.gm_direct;
    const margin = Math.max(0, num(inp.margin, 10));
    const maxSection = Math.max(1, num(inp.maxSection, 6));
    const pipes = pipeList();

    const pitchFor = Dmm => inp.pitchType === 'custom'
      ? Math.max(20, num(inp.pitch, Dmm))
      : Math.round(Dmm * pitchRatio / 5) * 5;

    // speed for a diameter / pipe — used both by auto-size and the final design
    function speedFor(Dmm, pipeOdM){
      const P = pitchFor(Dmm)/1000, Dm = Dmm/1000;
      const kInc = inclineFactor(theta, P/Dm, inp.trough);
      const vRev = Math.PI/4*(Dm*Dm - pipeOdM*pipeOdM) * P * fill * kInc / (flt.cf2[li] * D_.paddles.cf3[pad]);
      return { N: vRev > 0 ? Qv/(vRev*60) : Infinity, vRev, kInc, P };
    }
    const lumpAllowFor = (Dmm, pipeOdM) => ((Dmm + 25.4)/1000 - pipeOdM)/2*1000/lumpRatio;   // mm

    /* ---------- 1. screw diameter ---------- */
    let Dmm, autoNote = '';
    if (inp.Dmode === 'manual'){
      Dmm = clamp(num(inp.D, 300), 100, 1500);
    } else {
      // smallest size within 90 % of CEMA max speed (margin for surges); lump must pass
      const fits = k => s => {
        const od = D_.pipes[s.pipe].od/1000;
        return speedFor(s.D, od).N <= k*maxRpmFor(mat.load, s.D) && lump <= lumpAllowFor(s.D, od);
      };
      const cand = D_.sizes.find(fits(0.9)) || D_.sizes.find(fits(1.0));
      if (cand) Dmm = cand.D;
      else { Dmm = D_.sizes[D_.sizes.length-1].D; autoNote = 'Capacity or lump size exceeds the largest standard size — consider two conveyors in parallel.'; }
    }
    const row = sizeRow(Dmm);
    const Dm = Dmm/1000;
    const tFl = num(inp.tFl, row.tFl);

    /* ---------- 2. iterate pipe / shaft / hangers / power ---------- */
    let shaftMm = inp.shaftMode === 'auto' || !inp.shaftMode ? row.shaft : clamp(num(inp.shaftMode, row.shaft), 20, 250);
    const fitsShaft = (p, s) => (p.od - 2*p.t) >= s + 10;
    const pipeAllowOf = p => D_.pipeTau*1e6 * p.J/(p.odm/2);
    const pipeAuto = !inp.pipeMode || inp.pipeMode === 'auto';
    let pipeTreq = 0;                                   // torque the auto pipe must carry (set by the loop)
    function pickPipe(shaft){
      if (!pipeAuto && D_.pipes[inp.pipeMode]){
        const p = D_.pipes[inp.pipeMode]; return Object.assign({key:inp.pipeMode}, p, pipeGeom(p));
      }
      const def = Object.assign({key:row.pipe}, D_.pipes[row.pipe], pipeGeom(D_.pipes[row.pipe]));
      if (fitsShaft(def, shaft) && pipeAllowOf(def) >= pipeTreq) return def;
      return pipes.find(p => p.od >= def.od && fitsShaft(p, shaft) && p.od <= 0.6*Dmm && pipeAllowOf(p) >= pipeTreq) || def;
    }

    function flightPerM(pipe, P){
      const area = helicoidArea(Dm/2, pipe.odm/2, P);
      const massPitch = area * tFl/1000 * mocS.rho * fab.wt * flt.wt;
      return { area, massPitch, kgm: massPitch / P };
    }
    const deflLimitMm = inp.deflRule === 'cema'
      ? (mocS.paint ? 3.8 : 3.2)                       // CEMA Table R (+20 % for carbon steel)
      : 0.01 * Dmm;                                   // J&H: 1 % of screw diameter
    function deflection(pipe, P, span){
      const fl = flightPerM(pipe, P);
      const w = (pipe.A*mocS.rho + fl.kgm) * G * Math.cos(theta*Math.PI/180);    // N/m
      return 5*w*span**4/(384*E_STEEL*pipe.I) * 1000;                           // mm
    }
    function sectionsFor(pipe, P){
      const n0 = Math.ceil(Lscrew/maxSection - 1e-9);
      for (let n = n0; n <= 60; n++) if (deflection(pipe, P, Lscrew/n) <= deflLimitMm) return n;
      return 60;
    }

    let pipe, sp, nSec, hangers, pw, iter = 0, pipeHint = '';
    for (;;){
      pipe = pickPipe(shaftMm);
      // "avoid hangers" policy: upsize pipe until each section passes without extra hangers
      if (inp.hangerPolicy === 'pipe' && (!inp.pipeMode || inp.pipeMode === 'auto')){
        const nMin = Math.ceil(Lscrew/maxSection - 1e-9);
        const P0 = pitchFor(Dmm)/1000;
        const ok = pipes.find(p => p.A >= pipe.A*0.999 && p.od <= 0.6*Dmm && fitsShaft(p, shaftMm)
                                   && deflection(p, P0, Lscrew/nMin) <= deflLimitMm);
        if (ok) pipe = ok; else pipeHint = 'No standard pipe avoids hanger bearings at this length — hangers added.';
      }
      sp = speedFor(Dmm, pipe.odm);
      nSec = sectionsFor(pipe, sp.P);
      hangers = nSec - 1;
      pw = power(sp.N, hangers);
      const Tm = pw.motorKw > 0 && sp.N > 0 ? 9550*pw.motorKw/sp.N : 0;
      const reqShaft = D_.shafts.find(s => sAllow(s) >= Tm) || D_.shafts[D_.shafts.length-1];
      if ((inp.shaftMode === 'auto' || !inp.shaftMode) && reqShaft > shaftMm && iter < 6){ shaftMm = reqShaft; iter++; continue; }
      if (pipeAuto && pipeAllowOf(pipe) < Tm && Tm > pipeTreq && iter < 6){ pipeTreq = Tm; iter++; continue; }
      break;
    }
    function sAllow(d){ return sMat.tau*1e6 * Math.PI*(d/1000)**3/16; }   // N·m

    /* ---------- power ---------- */
    function power(N, nHang){
      const Lft = L*3.28084, Cft = Qv*35.3147, Wlb = mat.rho*0.062428;
      const Fd = interp(D_.Fd.dia, D_.Fd.val, Dmm/25.4);
      const Fb = nHang > 0 ? hb.fb : 1.0;
      const HPf = Lft*N*Fd*Fb/1e6;
      const HPm = Cft*Lft*Wlb*mat.fm*flt.ff[li]*D_.paddles.fp[pad]/1e6;
      const sum = HPf + HPm;
      const Fo = sum >= 5.2 ? 1 : clamp(-0.6115*Math.log(Math.max(sum, 1e-6)) + 2.024, 1, 3);
      const HPlift = Qt*1000*2.20462 * H*3.28084 / 1980000;
      const HPtot = (sum*Fo + HPlift)/drive.eff;
      const cemaKw = HPtot*0.7457;
      const dinShaftKw = Qt*(mat.lam*Lh + H)/367 + Dm*L/20;
      const dinKw = dinShaftKw/drive.eff;
      const jhKw = Qt*L*(mat.lam + H)/367 + L*Dm*0.05/1000;          // as the J&H web tool computes it
      const designKw = Math.max(cemaKw, dinKw) * (1 + margin/100);
      const motorKw = nextMotor(designKw);
      return { Fd, Fb, HPf, HPm, Fo, HPlift, HPtot, cemaKw, dinShaftKw, dinKw, jhKw, designKw, motorKw,
               governs: cemaKw >= dinKw ? 'CEMA' : 'DIN 15262 / J&H' };
    }

    /* ---------- 3. results ---------- */
    const N = sp.N, P = sp.P;
    const maxRpm = maxRpmFor(mat.load, Dmm);
    const fl = flightPerM(pipe, P);
    const span = Lscrew/nSec;
    const defl = deflection(pipe, P, span);
    const Tabs = N > 0 ? 9550*(pw.cemaKw*drive.eff)/N : 0;         // absorbed at screw
    const Tmotor = N > 0 ? 9550*pw.motorKw/N : 0;                  // full motor torque at screw
    const shaftAllow = sAllow(shaftMm);
    const pipeAllow = D_.pipeTau*1e6 * pipe.J/(pipe.odm/2);
    const lumpAllow = lumpAllowFor(Dmm, pipe.odm);
    const vAxial = N*P/60;
    const tipSpeed = Math.PI*Dm*N/60;
    const screwKg = (pipe.A*mocS.rho + fl.kgm) * Lscrew;

    /* ---------- 4. checks ---------- */
    const checks = [];
    const add = (lvl, msg) => checks.push({lvl, msg});
    if (Qt <= 0) add('fail', 'Enter a capacity (t/h).');
    if (autoNote) add('fail', autoNote);
    if (theta > 45) add('fail', `Incline ${theta}° is beyond inclined-screw practice — use a vertical screw or bucket elevator.`);
    else if (theta > 20 && inp.trough !== 'tube') add('warn', `Incline ${theta}° — a tubular housing reduces fall-back (capacity factor ${sp.kInc.toFixed(2)}).`);
    if (N > maxRpm) add('fail', `Speed ${N.toFixed(0)} rpm exceeds CEMA max ${maxRpm.toFixed(0)} rpm for ${mat.load} % loading — increase diameter.`);
    else if (N > 0.9*maxRpm) add('warn', `Speed is ${(N/maxRpm*100).toFixed(0)} % of CEMA max — little margin for capacity surges.`);
    else add('ok', `Speed ${N.toFixed(1)} rpm ≤ CEMA max ${maxRpm.toFixed(0)} rpm.`);
    if (N > 0 && N < 10) add('warn', `Very low speed (${N.toFixed(1)} rpm) — screw is oversized; a smaller diameter may suffice.`);
    if (lump > lumpAllow) add('fail', `Lump ${lump} mm exceeds the ${lumpAllow.toFixed(0)} mm allowed for this diameter / lump class.`);
    else if (lump > 0) add('ok', `Lump ${lump} mm ≤ ${lumpAllow.toFixed(0)} mm allowed.`);
    if (Tmotor > shaftAllow) add('fail', `Shaft Ø${shaftMm} overloaded: motor torque ${Tmotor.toFixed(0)} N·m > ${shaftAllow.toFixed(0)} N·m allowable.`);
    else add('ok', `Shaft Ø${shaftMm} ${sMat.label.split(' ')[0]}: ${(Tmotor/shaftAllow*100).toFixed(0)} % of torque rating.`);
    if (Tmotor > pipeAllow) add('fail', `Centre pipe overloaded in torsion (${Tmotor.toFixed(0)} > ${pipeAllow.toFixed(0)} N·m) — use heavier pipe.`);
    if (!fitsShaft(pipe, shaftMm)) add('fail', `Shaft Ø${shaftMm} does not fit pipe ID ${(pipe.od-2*pipe.t).toFixed(1)} mm (needs ≥ ${shaftMm+10} mm for bushing).`);
    if (pipe.od > 0.6*Dmm) add('warn', `Pipe OD ${pipe.od} mm is large for a Ø${Dmm} screw — flight is narrow.`);
    if (defl > deflLimitMm) add('fail', `Deflection ${defl.toFixed(1)} mm exceeds ${deflLimitMm.toFixed(1)} mm even at ${hangers} hangers.`);
    else add('ok', `Deflection ${defl.toFixed(1)} mm ≤ ${deflLimitMm.toFixed(1)} mm with ${hangers} hanger bearing${hangers===1?'':'s'} (span ${span.toFixed(2)} m).`);
    if (pipeHint) add('warn', pipeHint);
    if (mat.abr >= 2 && hangers > 0 && inp.hangerType !== 'hardiron') add('warn', 'Abrasive material with hanger bearings — use hard-iron hanger bearings and hardened coupling shafts.');
    if (mat.abr >= 2 && inp.mocScrew === 'MS' && tFl < 6) add('warn', `Abrasive material — consider ${Math.max(6, tFl+2)} mm flights or wear-resistant plate.`);
    if (mat.load === '45' && mat.abr >= 1) add('warn', '45 % loading is intended for free-flowing, non-abrasive materials.');
    if (num(inp.temp, 25) > 200) add('warn', `Material at ${inp.temp} °C — check thermal expansion, seals, bearings and paint.`);
    else if (num(inp.temp, 25) > 80) add('warn', `Material at ${inp.temp} °C — specify high-temperature seals and grease.`);
    if (inp.flightFab === 'helicoid' && Dmm > 400) add('warn', 'Helicoid flights are normally limited to ≤ 400 mm diameter — use sectional.');
    if (pw.governs !== 'CEMA') add('ok', `Motor governed by DIN/J&H power (${pw.dinKw.toFixed(2)} kW > CEMA ${pw.cemaKw.toFixed(2)} kW).`);
    if (pw.motorKw / pw.designKw > 1.6 && pw.motorKw > 1) add('ok', `Motor ${pw.motorKw} kW has generous margin over ${pw.designKw.toFixed(2)} kW required.`);

    return {
      Dmm, Dm, P, Pmm: Math.round(P*1000), row, pipe, shaftMm, tFl, L, Lscrew, Lh, H, theta, Qt, Qv, fill, mat, flt, fab, pad,
      N, maxRpm, speedPct: N/maxRpm*100, vRev: sp.vRev, kInc: sp.kInc, vAxial, tipSpeed,
      power: pw, motorKw: pw.motorKw, drive, gearRatio: N > 0 ? 1450/N : 0,
      Tabs, Tmotor, shaftAllow, pipeAllow, sMat, hb,
      nSec, hangers, span, defl, deflLimitMm, flight: fl, screwKg,
      lump, lumpAllow, checks,
      status: checks.some(c => c.lvl === 'fail') ? 'fail' : (checks.some(c => c.lvl === 'warn') ? 'warn' : 'ok')
    };
  };

  /* =================================================================
     FABRICATION BOQ
     ================================================================= */
  SC.boq = function(inp, R, rates){
    rates = Object.assign({}, SC.DEFAULT_RATES, rates || {});
    const mS = D_.mocs[inp.mocScrew] || D_.mocs.MS;
    const mT = D_.mocs[inp.mocTrough] || D_.mocs.MS;
    const mX = D_.mocs[inp.mocStruct] || D_.mocs.MS;
    const kS = inp.mocScrew || 'MS', kT = inp.mocTrough || 'MS', kX = inp.mocStruct || 'MS';
    const Dmm = R.Dmm, Dm = R.Dm, L = R.L, row = R.row;
    const inch = Dmm/25.4;
    const A = (Dmm + 25.4)/1000;                                   // trough inside width
    const B = interp(D_.troughB.dia, D_.troughB.B, inch)/1000;     // side height above CL
    const C = interp(D_.troughB.dia, D_.troughB.C, inch)/1000;     // top flange
    const tTr = num(inp.tTr, row.tTr)/1000, tCv = num(inp.tCv, row.tCv)/1000, tEnd = num(inp.tEnd, row.tEnd)/1000;
    const trough = inp.trough || 'U';
    const nT = Math.max(1, Math.ceil(L / Math.max(0.5, num(inp.trSec, 3)) - 1e-9));   // trough sections
    const ang = D_.angles.find(a => Dmm <= a.maxD);
    const leg = D_.legs.find(a => Dmm <= a.maxD);
    const kw = R.motorKw;
    const d = R.shaftMm/1000;
    const items = [];

    const plateItem = (grp, name, spec, qty, unit, unitKg, t, moc, mocKey, labF, sides, extra) => {
      const net = unitKg*qty;
      items.push(Object.assign({ grp, name, spec, qty, unit, unitKg, net,
        raw:{ kind:'plate', key:`PL ${+(t*1000).toFixed(1)} mm — ${mocKey}`, waste:rates.wPlate, moc:mocKey },
        area: sides ? net/(moc.rho*t)*sides : 0, mocKey, labF }, extra || {}));
    };

    /* ----- A. Screw assembly ----- */
    const flightsPerScrew = Math.ceil(R.Lscrew / R.P * 2 - 1e-9) / 2;   // to nearest half flight
    const flKg = R.flight.massPitch;
    items.push({ grp:'Screw assembly', name:'Screw flights',
      spec:`${R.fab.label.split(' (')[0]} · ${R.flt.label} · Ø${Dmm} × ${R.Pmm} pitch × ${R.tFl} mm · ${screwHandLabel(inp)}`,
      qty:flightsPerScrew, unit:'pitch', unitKg:flKg, net:flKg*flightsPerScrew,
      raw:{ kind:'plate', key:`PL ${R.tFl} mm — ${kS} (flights)`, waste:rates.wFlight, moc:kS },
      area: R.flight.area*2*flightsPerScrew*R.flt.wt, mocKey:kS, labF:R.fab.lab });

    const pipeKgM = R.pipe.A*mS.rho;
    items.push({ grp:'Screw assembly', name:'Centre pipe',
      spec:`${R.pipe.label} (Ø${R.pipe.od} × ${R.pipe.t}) · ${R.nSec} section${R.nSec>1?'s':''}`,
      qty:+R.Lscrew.toFixed(2), unit:'m', unitKg:pipeKgM, net:pipeKgM*R.Lscrew,
      raw:{ kind:'pipe', key:`Pipe Ø${R.pipe.od} × ${R.pipe.t} — ${kS}`, waste:rates.wPipe, moc:kS, len:R.Lscrew },
      area: Math.PI*R.pipe.od/1000*R.Lscrew, mocKey:kS, labF:0.6 });

    const pid = R.pipe.od - 2*R.pipe.t;
    const bushKg = Math.max(0.2, Math.PI/4*((pid/1000)**2 - (d+0.002)**2) * 1.5*d * RHO_STEEL);
    items.push({ grp:'Machined parts', name:'End bushings / internal collars',
      spec:`Bored Ø${R.shaftMm + 1}, turned to pipe ID ${pid.toFixed(1)}, 2 per section`,
      qty:2*R.nSec, unit:'nos', unitKg:bushKg, net:bushKg*2*R.nSec,
      raw:{ kind:'bar', key:`RB Ø${Math.ceil(pid/5)*5} — ${kS}`, waste:rates.wBar, moc:kS }, area:0, mocKey:kS, labF:0.8 });

    const sm = R.sMat, shaftKey = inp.shaftMat || 'C45';
    const shafts = [
      { name:'Drive shaft',    len:0.20 + 4.3*d, qty:1 },
      { name:'Tail shaft',     len:0.15 + 3.2*d, qty:1 },
      { name:'Coupling shafts',len:0.05 + 5.0*d, qty:R.hangers }
    ];
    shafts.forEach(s => {
      if (s.qty <= 0) return;
      const net = Math.PI/4*d*d*s.len*sm.rho;
      const rawKg = Math.PI/4*(d+0.010)**2*(s.len+0.03)*sm.rho;
      items.push({ grp:'Machined parts', name:s.name,
        spec:`Ø${R.shaftMm} × ${Math.round(s.len*1000)} long · ${sm.label} · machined, keyed, drilled`,
        qty:s.qty, unit:'nos', unitKg:net, net:net*s.qty, rawUnitKg:rawKg,
        raw:{ kind:'bar', key:`RB Ø${R.shaftMm + 10} — ${shaftKey}`, waste:rates.wBar, moc:shaftKey, shaft:true },
        area:0, mocKey:shaftKey, labF:0.5, shaft:true });
    });

    /* ----- B. Trough & casing ----- */
    let Wt, tLabel;
    if (trough === 'tube'){ Wt = Math.PI*(A + tTr); tLabel = 'Tubular housing'; }
    else { Wt = Math.PI*A/2 + 2*B + 2*C; if (trough === 'flared') Wt *= 1.07; tLabel = trough === 'flared' ? 'Flared trough' : 'U-trough'; }
    const trKgM = Wt*tTr*mT.rho;
    plateItem('Trough & casing', tLabel,
      `${Math.round(tTr*1000)} mm · ${nT} section${nT>1?'s':''} · developed width ${Math.round(Wt*1000)} mm`,
      +L.toFixed(2), 'm', trKgM, tTr, mT, kT, 1.0, 2);

    const flLen = trough === 'tube' ? Math.PI*(A + 2*tTr) : Math.PI*A/2 + 2*B;
    items.push({ grp:'Trough & casing', name:'Trough end / joint flanges',
      spec:`${ang.spec} rolled to profile, ${Math.round(flLen*1000)} mm developed`,
      qty:2*nT, unit:'nos', unitKg:flLen*ang.kgm, net:flLen*ang.kgm*2*nT,
      raw:{ kind:'section', key:`${ang.spec} — ${kT}`, waste:rates.wPlate, moc:kT, len:flLen*2*nT },
      area: flLen*0.2*2*nT, mocKey:kT, labF:1.4 });

    if (trough !== 'tube' && inp.covers !== false){
      const Wc = A + 2*C + 0.05;
      plateItem('Trough & casing', 'Trough covers',
        `${Math.round(tCv*1000)} mm flanged, ${Math.round(Wc*1000)} mm wide · ${nT} pcs`,
        +L.toFixed(2), 'm', Wc*tCv*mT.rho, tCv, mT, kT, 0.8, 2);
    }

    const endW = trough === 'tube' ? A + 0.15 : A + 2*C + 0.10;
    const endH = trough === 'tube' ? A + 0.15 : A/2 + B + 0.10;
    plateItem('Trough & casing', 'Trough end plates',
      `${Math.round(tEnd*1000)} mm · ${Math.round(endW*1000)} × ${Math.round(endH*1000)} with feet & bearing pad`,
      2, 'nos', endW*endH*tEnd*mT.rho*0.9, tEnd, mT, kT, 1.3, 2);

    const tSp = Math.max(3, Math.round(tTr*1000))/1000;
    const spout = (n, h, name) => {
      if (n <= 0) return;
      const Lo = Dm, Wo = A;
      const kg = (2*(Lo + Wo)*h*tSp + 2*(Lo + Wo + 0.2)*0.05*(tSp + 0.002)) * mT.rho;
      plateItem('Trough & casing', name, `${Math.round(Lo*1000)} × ${Math.round(Wo*1000)} opening, ${Math.round(h*1000)} high, flanged`,
        n, 'nos', kg, tSp, mT, kT, 1.5, 2);
    };
    spout(Math.max(0, Math.round(num(inp.inlets, 1))), 0.15, 'Inlet spouts');
    spout(Math.max(0, Math.round(num(inp.outlets, 1))), 0.20, 'Discharge spouts');

    if (R.hangers > 0){
      const hk = (A + 2*C + B + 0.15)*0.10*0.012*mT.rho;
      plateItem('Trough & casing', 'Hanger brackets', `12 mm plate frame for ${R.hb.label.toLowerCase()}`,
        R.hangers, 'nos', hk, 0.012, mT, kT, 1.5, 2);
    }

    /* ----- C. Supports & drive base ----- */
    const nSup = nT + 1;
    const sadKg = ((Math.PI*A/2 + 0.2)*0.08*0.008 + (A + 2*C + 0.1)*0.15*0.010) * mX.rho;
    plateItem('Supports & drive', 'Trough saddles / feet', `Flat 80×8 band + 10 mm base plate`, nSup, 'nos', sadKg, 0.010, mX, kX, 1.2, 2);
    const legH = Math.max(0, num(inp.legH, 0));
    if (legH > 0){
      const legLen = (2*legH + (A + 2*C + 0.2)*0.8) ;
      items.push({ grp:'Supports & drive', name:'Support trestles',
        spec:`${leg.spec}, 2 legs × ${legH} m + cross brace, per support`,
        qty:nSup, unit:'nos', unitKg:legLen*leg.kgm + 2*0.2*0.2*0.012*mX.rho, net:(legLen*leg.kgm + 2*0.2*0.2*0.012*mX.rho)*nSup,
        raw:{ kind:'section', key:`${leg.spec} — ${kX}`, waste:rates.wPlate, moc:kX, len:legLen*nSup },
        area: legLen*0.4*nSup, mocKey:kX, labF:1.0 });
    }
    const dk = inp.drive || 'gm_direct';
    const baseKg = dk === 'gm_shaft' ? 6 + 0.4*kw : (dk === 'gm_direct' ? 20 + 4*kw : 15 + 3*kw);
    const baseName = dk === 'gm_shaft' ? 'Torque arm & bracket' : 'Drive base frame';
    plateItem('Supports & drive', baseName, `Fabricated for ${kw} kW drive`, 1, 'lot', baseKg, 0.010, mX, kX, 1.3, 2);
    if (dk !== 'gm_shaft'){
      const gKg = dk === 'gm_direct' ? 5 + 0.3*kw : 8 + 0.6*kw;
      plateItem('Supports & drive', dk === 'gm_direct' ? 'Coupling guard' : 'Belt / chain guard', '2 mm sheet + mesh', 1, 'lot', gKg, 0.002, mX, kX, 1.5, 2);
    }

    const fabNet = items.reduce((a, it) => a + it.net, 0);
    plateItem('Supports & drive', 'Misc. stiffeners, gussets & lifting lugs', '3 % allowance on fabricated weight',
      1, 'lot', fabNet*0.03, 0.008, mT, kT, 1.2, 2);

    // gross (purchased) weight per item
    items.forEach(it => {
      const base = it.rawUnitKg ? it.rawUnitKg*it.qty : it.net;
      it.gross = base * (1 + (it.raw.waste||0)/100);
    });

    /* ----- Raw material take-off ----- */
    const rawMap = {};
    items.forEach(it => {
      const k = it.raw.key;
      const r = rawMap[k] || (rawMap[k] = { key:k, kind:it.raw.kind, moc:it.raw.moc, net:0, gross:0, len:0, shaft:!!it.raw.shaft });
      r.net += it.net; r.gross += it.gross; r.len += it.raw.len || 0;
    });
    const kindOrder = { plate:1, pipe:2, section:3, bar:4 };
    const raw = Object.values(rawMap).sort((a,b) => (kindOrder[a.kind]-kindOrder[b.kind]) || a.key.localeCompare(b.key, undefined, {numeric:true}));

    /* ----- Bought-out items ----- */
    const bought = [];
    const BO = (name, spec, qty, unit, unitPrice) => { if (qty > 0) bought.push({ name, spec, qty, unit, unitPrice }); };
    const ds = R.shaftMm/50;
    BO('Geared motor', `${kw} kW, 4-pole, ~${Math.round(R.N)} rpm output (ratio ≈ ${R.gearRatio.toFixed(1)}), ${R.drive.label}`, 1, 'nos', rates.motorA + rates.motorB*kw);
    if (dk === 'gm_direct') BO('Flexible coupling', `Jaw / tyre coupling for Ø${R.shaftMm} shaft`, 1, 'nos', 150 + 4*R.shaftMm);
    if (dk === 'smr_belt')  BO('V-belt drive set', `Pulleys, belts, bushes for ${kw} kW`, 1, 'set', 300 + 25*kw);
    if (dk === 'gm_chain')  BO('Chain & sprocket set', `Duplex chain, sprockets, tensioner for ${kw} kW`, 1, 'set', 400 + 30*kw);
    const eb = D_.endBearings[inp.endBearing] || D_.endBearings.flange;
    BO('End bearings', `${eb.label}, bore Ø${R.shaftMm}`, 2, 'nos', eb.price*Math.pow(ds, 1.8));
    const sl = D_.seals[inp.seal] || D_.seals.gland;
    BO('Shaft seals', `${sl.label}, Ø${R.shaftMm}`, 2, 'nos', sl.price*ds);
    BO('Hanger bearings', `${R.hb.label}, Ø${R.shaftMm}`, R.hangers, 'nos', R.hb.price*ds);
    const boltM = R.shaftMm <= 40 ? 12 : R.shaftMm <= 65 ? 16 : R.shaftMm <= 75 ? 20 : R.shaftMm <= 90 ? 22 : R.shaftMm <= 110 ? 24 : 30;
    const perConn = R.shaftMm >= 75 ? 3 : 2;
    const conns = 2 + 2*R.hangers;
    BO('Coupling bolts (Gr 8.8)', `M${boltM} × ${perConn} per connection × ${conns} connections`, perConn*conns, 'nos', rates.bolt*Math.pow(boltM/12, 2)*2);
    const nBolts = Math.ceil(
        (nT + 1)*Math.ceil(flLen/0.15)                                         // trough joint + end flanges
      + (trough !== 'tube' ? 2*Math.ceil(L/0.3) : 0)                            // cover bolts / clamps
      + (num(inp.inlets,1) + num(inp.outlets,1))*Math.ceil(2*(Dm + A)/0.15)     // spout flanges
      + 4*R.hangers + 4*nSup + 8);                                               // hangers, feet, drive
    BO('General fasteners (Gr 8.8 HDG)', 'Trough, cover, spout, hanger & foot bolts', nBolts, 'sets', rates.bolt);
    const gasM = (trough !== 'tube' ? 2*L + nT*(A + 2*C) : 0) + (nT + 1)*flLen + (num(inp.inlets,1) + num(inp.outlets,1))*2*(Dm + A);
    BO('Gaskets', 'Neoprene / EPDM 3 mm — covers, flanges, spouts', +gasM.toFixed(1), 'm', rates.gasket);
    (D_.extras || []).forEach(x => {
      const e = (inp.extras || {})[x.key];
      if (e && e.on) BO(x.label, 'Optional — in scope', Math.max(1, num(e.qty, 1)), 'nos', num(e.price, x.base + x.perKw*kw));
    });

    /* ----- Services ----- */
    // machining is included in the all-in rate of the "Machined parts" group
    const services = [];
    const asmHr = 4 + 1.0*L + 1.0*R.hangers;
    services.push({ name:'Shop assembly & no-load test run', spec:'Trial assembly, alignment, run test', qty:+asmHr.toFixed(1), unit:'h', unitPrice:rates.shopHr });
    let paintA = 0, pickA = 0;
    items.forEach(it => {
      const m = D_.mocs[it.mocKey];
      if (!it.area) return;
      const interior = /flight|pipe|trough$|U-trough|Flared|Tubular/i.test(it.name);
      const a = (interior && inp.paintInside === false) ? it.area/2 : it.area;
      if (m && m.paint) paintA += a; else if (m) pickA += a;
    });
    if (paintA > 0) services.push({ name:'Surface prep & painting', spec:inp.paintSpec || 'SA 2.5 blast, epoxy primer + PU finish (~150 µm)', qty:+paintA.toFixed(1), unit:'m²', unitPrice:rates.paint });
    if (pickA > 0)  services.push({ name:'Pickling & passivation', spec:'Stainless steel parts', qty:+pickA.toFixed(1), unit:'m²', unitPrice:rates.pickle });

    const totals = {
      net: items.reduce((a, it) => a + it.net, 0),
      gross: items.reduce((a, it) => a + it.gross, 0)
    };
    return { items, raw, bought, services, totals, geom:{ A, B, C, Wt, nT, nSup, flLen } };
  };

  function screwHandLabel(inp){ return inp.hand === 'LH' ? 'LH' : 'RH'; }

  /* =================================================================
     COSTING
     ================================================================= */
  SC.cost = function(B, inp, rates){
    rates = Object.assign({}, SC.DEFAULT_RATES, rates || {});
    const ov = inp.priceOverrides || {};
    const lines = [];
    /* Fabricated items: net weight × all-in rate (material + labour [+ machining]) of the
       item's group, × material factor for stainless / wear plate / alloy shafts. */
    B.items.forEach(it => {
      const rate = num(rates[SC.RATE_GROUPS[it.grp]], 0) * SC.mocFactor(it.mocKey, rates);
      const base = it.net*rate;
      const id = 'F:'+it.name;
      const amount = ov[id] != null && ov[id] !== '' ? num(ov[id], base) : base;
      lines.push({ id, sec:'Fabricated items', grp:it.grp, name:it.name, spec:it.spec, qty:it.qty, unit:it.unit, net:it.net, gross:it.gross,
                   rate, amount, overridden: amount !== base });
    });
    B.bought.forEach((b, i) => {
      const id = 'B:'+b.name, base = b.qty*b.unitPrice;
      const amount = ov[id] != null && ov[id] !== '' ? num(ov[id], base) : base;
      lines.push({ id, sec:'Bought-out items', name:b.name, spec:b.spec, qty:b.qty, unit:b.unit, unitPrice:b.unitPrice, amount, overridden: amount !== base });
    });
    B.services.forEach((s, i) => {
      const id = 'S:'+s.name, base = s.qty*s.unitPrice;
      const amount = ov[id] != null && ov[id] !== '' ? num(ov[id], base) : base;
      lines.push({ id, sec:'Services', name:s.name, spec:s.spec, qty:s.qty, unit:s.unit, unitPrice:s.unitPrice, amount, overridden: amount !== base });
    });
    const sum = sec => lines.filter(l => l.sec === sec).reduce((a, l) => a + l.amount, 0);
    const fab = sum('Fabricated items'), bo = sum('Bought-out items'), sv = sum('Services');
    const direct = fab + bo + sv;
    const overhead = direct*rates.overhead/100;
    const contingency = (direct + overhead)*rates.contingency/100;
    const costTotal = direct + overhead + contingency;
    const profit = costTotal*rates.profit/100;
    const sellUnit = costTotal + profit;
    const qty = Math.max(1, Math.round(num(inp.qty, 1)));
    return { lines, fab, bo, sv, direct, overhead, contingency, costTotal, profit, sellUnit, qty,
             sellTotal: sellUnit*qty, perKg: B.totals.net > 0 ? sellUnit/B.totals.net : 0, currency: rates.currency };
  };

  /* BOQ group → all-in rate key in SC.DEFAULT_RATES */
  SC.RATE_GROUPS = { 'Screw assembly':'rScrew', 'Machined parts':'rMach', 'Trough & casing':'rTrough', 'Supports & drive':'rStruct' };
  /* all-in rate multiplier by material: carbon steel / C45 = 1 */
  SC.mocFactor = (key, rates) => num((rates || SC.DEFAULT_RATES)['f' + key], 1);

  SC.util = { num, interp, helicoidArea, inclineFactor, maxRpmFor, nextMotor };
})();
