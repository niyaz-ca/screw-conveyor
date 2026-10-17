/* =====================================================================
   Excel BOQ export — SC.exportBoqXlsx(S) → { blob, filename }
   Sheets: BOQ (live formulas: edit the yellow rate cells and Excel
           recalculates), Purchase list, Design.
   Style numbers: see the table at the top of xlsx.js.
   ===================================================================== */
(function(){
  const D_ = SC.DATA;
  const T = (v, s) => ({ v: v == null ? '' : String(v), s });
  const N = (v, s) => ({ v: +v, s });
  const F = (f, v, s) => ({ f, v, s });
  const r2 = x => Math.round(x*100)/100;

  function sheet(name, cols, landscape){
    const sh = { name, cols, rows:[], landscape };
    sh.add = (cells, ht) => { sh.rows.push({ cells, ht }); return sh.rows.length; };
    sh.next = () => sh.rows.length + 1;
    return sh;
  }

  SC.exportBoqXlsx = function(S){
    const R = S.R, B = S.B, C = S.C, i = S.inp, rates = S.rates, cur = rates.currency || 'AED';

    /* ================= BOQ ================= */
    const sh = sheet('BOQ', [5, 30, 60, 9, 8, 7, 11, 7, 11, 14], true);
    sh.add([T('SCREW CONVEYOR — BILL OF QUANTITIES & ESTIMATE', 1)], 22);
    sh.add([T([i.client, i.project, i.tag && 'Tag ' + i.tag, i.date, 'Rev ' + (i.rev || '0'), i.preparedBy && 'by ' + i.preparedBy].filter(Boolean).join('  ·  '), 12)]);
    sh.add([]);
    const info = [
      ['Material', `${i.matName} — ${R.mat.rho} kg/m³`],
      ['Capacity', `${r2(R.Qt)} t/h (${r2(R.Qv)} m³/h)`],
      ['Length / incline', `${r2(R.L)} m @ ${r2(R.theta)}°`],
      ['Screw', `Ø${R.Dmm} × ${R.Pmm} pitch · ${R.tFl} mm flights · ${R.flt.label}`],
      ['Speed / motor', `${R.N.toFixed(1)} rpm · ${R.motorKw} kW (${R.drive.label})`],
      ['Shaft / pipe / hangers', `Ø${R.shaftMm} ${R.sMat.label} · ${R.pipe.label} · ${R.hangers} hanger(s)`],
      ['Design status', { ok:'Design OK', warn:'OK — see notes on Design sheet', fail:'NOT ACCEPTABLE — see Design sheet' }[R.status]]
    ];
    info.forEach(([a, b]) => sh.add(['', T(a, 10), T(b, 19)]));
    const qtyRow = sh.add(['', T('Quantity of conveyors', 10), N(C.qty, 18), T('nos')]);
    const qtyRef = `$C$${qtyRow}`;
    sh.add([]);
    sh.add(['', T('RATES & MARGINS — edit the yellow cells, the sheet recalculates', 10)]);
    const rateRef = {};
    [['rScrew', 'Screw (flights + centre pipe)', `${cur}/kg`], ['rMach', 'Machined parts (shafts, bushings)', `${cur}/kg`],
     ['rTrough', 'Trough & casing', `${cur}/kg`], ['rStruct', 'Supports & drive', `${cur}/kg`],
     ['overhead', 'Overhead', '%'], ['contingency', 'Contingency', '%'], ['profit', 'Profit', '%']]
      .forEach(([k, label, unit]) => { const r = sh.add(['', T(label, 3), N(rates[k], 9), T(unit)]); rateRef[k] = `$C$${r}`; });
    sh.add(['', T('All-in rate = material + labour per kg of finished weight. Factor = material multiplier (SS, Hardox, alloy shafts).', 12)]);
    sh.add([]);
    sh.add(['No.', 'Item', 'Description', 'MOC', 'Qty', 'Unit', 'Weight kg', 'Factor', `Rate ${cur}`, `Amount ${cur}`].map(h => T(h, 2)), 18);

    let n = 0;
    const subJ = [], subG = [];
    const groupHead = name => sh.add([T('', 7), T(name, 7), T('', 7), T('', 7), T('', 7), T('', 7), T('', 7), T('', 7), T('', 7), T('', 7)]);
    const subtotal = (label, r0, r1, withWeight, cachedKg, cachedAmt) => {
      const r = sh.add([T('', 13), T(label, 13), T('', 13), T('', 13), T('', 13), T('', 13),
        withWeight ? F(`SUM(G${r0}:G${r1})`, r2(cachedKg), 15) : T('', 13), T('', 13), T('', 13), F(`SUM(J${r0}:J${r1})`, Math.round(cachedAmt), 14)]);
      return r;
    };

    // fabricated groups
    const fab = C.lines.filter(l => l.sec === 'Fabricated items');
    const groups = [];
    fab.forEach(l => { let g = groups.find(x => x.name === l.grp); if (!g) groups.push(g = { name:l.grp, lines:[] }); g.lines.push(l); });
    groups.forEach(g => {
      groupHead(g.name);
      const r0 = sh.next();
      const rk = SC.RATE_GROUPS[g.name];
      g.lines.forEach(l => {
        const it = B.items.find(x => 'F:' + x.name === l.id);
        const factor = SC.mocFactor(it.mocKey, rates);
        const r = sh.next();
        const unitIsLen = l.unit === 'm';
        sh.add([N(++n, 5), T(l.name, 3), T(l.spec + (l.overridden ? '  [price fixed by estimator]' : ''), 11), T(it.mocKey, 3),
          N(unitIsLen ? r2(l.qty) : l.qty, unitIsLen ? 4 : 5), T(l.unit, 3), N(r2(l.net), 6), N(factor, 4),
          F(`${rateRef[rk]}*H${r}`, r2(l.rate), 4),
          l.overridden ? N(Math.round(l.amount), 18) : F(`G${r}*I${r}`, Math.round(l.amount), 5)]);
      });
      const r1 = sh.next() - 1;
      const rs = subtotal(`Subtotal — ${g.name}`, r0, r1, true, g.lines.reduce((a, l) => a + l.net, 0), g.lines.reduce((a, l) => a + l.amount, 0));
      subJ.push(`J${rs}`); subG.push(`G${rs}`);
    });

    // bought-out and services
    const other = (sec) => {
      const list = C.lines.filter(l => l.sec === sec);
      if (!list.length) return null;
      groupHead(sec);
      const r0 = sh.next();
      list.forEach(l => {
        const r = sh.next();
        // an estimator's price replaces the unit price, so the row still reads qty × unit price
        const unit = l.overridden && l.qty > 0 ? l.amount/l.qty : l.unitPrice;
        sh.add([N(++n, 5), T(l.name, 3), T(l.spec + (l.overridden ? '  [price fixed by estimator]' : ''), 11), T('', 3),
          N(r2(l.qty), l.qty % 1 ? 4 : 5), T(l.unit, 3), T('', 3), T('', 3), N(r2(unit), 9),
          F(`E${r}*I${r}`, Math.round(l.amount), 5)]);
      });
      return `J${subtotal(`Subtotal — ${sec}`, r0, sh.next() - 1, false, 0, list.reduce((a, l) => a + l.amount, 0))}`;
    };
    const boRef = other('Bought-out items');
    const svRef = other('Services');

    /* price build-up */
    sh.add([]);
    const k = (label, f, v, sKey) => sh.add(['', T(label, sKey ? 16 : 10), '', '', '', '', '', '', '', F(f, Math.round(v), sKey ? 17 : 14)]);
    const fabW = sh.add(['', T('Fabricated items', 10), '', '', '', '', F(subG.join('+') || '0', r2(B.totals.net), 15), '', '', F(subJ.join('+') || '0', Math.round(C.fab), 14)]);
    const boW = k('Bought-out items', boRef || '0', C.bo);
    const svW = k('Services', svRef || '0', C.sv);
    const dcW = k('Direct cost', `J${fabW}+J${boW}+J${svW}`, C.direct);
    const ohW = k('Overhead (rate above)', `J${dcW}*${rateRef.overhead}/100`, C.overhead);
    const ctW = k('Contingency (rate above)', `(J${dcW}+J${ohW})*${rateRef.contingency}/100`, C.contingency);
    const tcW = k('Total cost', `J${dcW}+J${ohW}+J${ctW}`, C.costTotal);
    const prW = k('Profit (rate above)', `J${tcW}*${rateRef.profit}/100`, C.profit);
    const spW = k(`Selling price per conveyor (${cur})`, `J${tcW}+J${prW}`, C.sellUnit, true);
    k(`Total for quantity (${cur})`, `J${spW}*${qtyRef}`, C.sellTotal, true);
    sh.add(['', T(`Price per kg (${cur}/kg)`, 10), '', '', '', '', '', '', '', F(`IF(G${fabW}>0,J${spW}/G${fabW},0)`, r2(C.perKg), 20)]);
    sh.add([]);
    sh.add(['', T('Preliminary estimate for budgeting (±20–25 %). Bought-out prices are budget figures — replace with vendor quotes for a firm offer.', 12)]);

    /* ================= PURCHASE LIST ================= */
    const pl = sheet('Purchase list', [42, 12, 12, 12, 12, 12]);
    pl.add([T('RAW MATERIAL TAKE-OFF — per conveyor', 1)], 22);
    pl.add([T(`${i.project || ''} ${i.tag ? '· Tag ' + i.tag : ''} · multiply by ${C.qty} for the full quantity`, 12)]);
    pl.add([]);
    pl.add(['Stock item', 'MOC', 'Length m', 'Net kg', 'Wastage %', 'Buy kg'].map(h => T(h, 2)), 18);
    const p0 = pl.next();
    B.raw.forEach(x => {
      const r = pl.next();
      const w = x.net > 0 ? Math.round((x.gross/x.net - 1)*1000)/10 : 0;
      pl.add([T(x.key, 3), T(x.moc, 3), x.len ? N(r2(x.len), 4) : T('', 3), N(r2(x.net), 6), N(w, 6), F(`D${r}*(1+E${r}/100)`, r2(x.gross), 6)]);
    });
    const p1 = pl.next() - 1;
    pl.add([T('Total', 13), T('', 13), T('', 13), F(`SUM(D${p0}:D${p1})`, r2(B.totals.net), 15), T('', 13), F(`SUM(F${p0}:F${p1})`, r2(B.totals.gross), 15)]);
    pl.add([]);
    pl.add([T('Wastage for round bar includes the machining allowance (bar bought 10 mm over shaft size).', 12)]);

    /* ================= DESIGN ================= */
    const ds = sheet('Design', [36, 30, 14]);
    ds.add([T('SCREW CONVEYOR — DESIGN SUMMARY', 1)], 22);
    ds.add([T('CEMA 350 method, DIN 15262 / J&H power check', 12)]);
    const sec = t => { ds.add([]); ds.add([T(t, 7), T('', 7), T('', 7)]); };
    const kv = (a, b, u) => ds.add([T(a, 3), typeof b === 'number' ? N(r2(b), 4) : T(b, 3), T(u || '', 3)]);
    sec('Duty');
    kv('Material', i.matName); kv('Bulk density', R.mat.rho, 'kg/m³'); kv('Loading class / fill', `${R.mat.load} / ${Math.round(R.fill*100)} %`);
    kv('Material factor Fm / power factor λ', `${R.mat.fm} / ${R.mat.lam}`); kv('Capacity', R.Qt, 't/h'); kv('Volume flow', R.Qv, 'm³/h');
    kv('Length (overall)', R.L, 'm'); kv('Incline', R.theta, '°'); kv('Lift height', R.H, 'm');
    sec('Screw');
    kv('Diameter', R.Dmm, 'mm'); kv('Pitch', R.Pmm, 'mm'); kv('Flight', `${R.flt.label}, ${R.fab.label.split(' (')[0]}`); kv('Flight thickness', R.tFl, 'mm');
    kv('Centre pipe', `${R.pipe.label} (Ø${R.pipe.od} × ${R.pipe.t})`); kv('Shaft', `Ø${R.shaftMm} ${R.sMat.label}`);
    kv('Screw sections / hangers', `${R.nSec} / ${R.hangers}`); kv('Section span', R.span, 'm');
    kv('Deflection / limit', `${R.defl.toFixed(1)} / ${R.deflLimitMm.toFixed(1)}`, 'mm');
    sec('Speed & power');
    kv('Speed', R.N, 'rpm'); kv('CEMA maximum speed', R.maxRpm, 'rpm'); kv('Power — CEMA', R.power.cemaKw, 'kW');
    kv('Power — DIN 15262 / J&H', R.power.dinKw, 'kW'); kv('Required (incl. margin)', R.power.designKw, 'kW'); kv('Motor', R.motorKw, 'kW');
    kv('Drive', R.drive.label); kv('Gear ratio from 1450 rpm', R.gearRatio);
    kv('Torque at motor rating', R.Tmotor, 'N·m'); kv('Shaft allowable torque', R.shaftAllow, 'N·m');
    sec('Construction');
    kv('Trough', `${D_.troughTypes[i.trough] ? D_.troughTypes[i.trough].label : i.trough}, ${i.tTr || R.row.tTr} mm`);
    kv('Materials (screw / trough / supports)', `${i.mocScrew} / ${i.mocTrough} / ${i.mocStruct}`);
    kv('Trough sections', B.geom.nT); kv('Inlets / outlets', `${i.inlets} / ${i.outlets}`);
    kv('Fabricated weight', B.totals.net, 'kg');
    sec('Design checks');
    R.checks.forEach(c => ds.add([T({ ok:'OK', warn:'NOTE', fail:'NOT OK' }[c.lvl], c.lvl === 'ok' ? 3 : 10), T(c.msg, 3)]));

    const safe = s => String(s || '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '');
    return {
      blob: SC.xlsx.build([sh, pl, ds]),
      filename: `BOQ_${safe(i.project) || 'Project'}_${safe(i.tag) || 'SC'}.xlsx`
    };
  };
})();
