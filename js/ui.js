/* =====================================================================
   SCREW CONVEYOR ESTIMATOR — user interface
   Two tabs:  Design (inputs left, live results right)
              BOQ & Cost (weights + prices in one place, rates folded)
   State lives in S.inp (project inputs) and S.rates (commercial rates).
   Every change → recompute() → SC.design → SC.boq → SC.cost → render.
   ===================================================================== */
(function(){
  const D_ = SC.DATA;
  const $ = s => document.querySelector(s);
  const LS = { cur:'sce_current_v1', rates:'sce_rates_v1', lib:'sce_projects_v1', step:'sce_step_v2', open:'sce_open_v1' };

  const today = () => new Date().toISOString().slice(0,10);
  const DEF = () => ({
    client:'', project:'', tag:'SC-01', preparedBy:'', date:today(), rev:'0', qty:1,
    matKey:'cement', matName:'Cement, Portland (settled)', rho:1500, load:'30B', fillPct:'', fm:1.4, lam:3.0, abr:1,
    lump:0, lumpClass:1, temp:40,
    tph:15, L:8, angle:0,
    Dsel:'auto', Dcustom:350, pitchType:'full', pitch:'', flight:'std', paddles:0, flightFab:'sectional', tFl:'', hand:'RH',
    pipeMode:'auto', shaftMode:'auto', shaftMat:'C45', hangerPolicy:'hangers', hangerType:'bronze', maxSection:6, deflRule:'jh',
    drive:'gm_direct', margin:10,
    trough:'U', mocScrew:'MS', mocTrough:'MS', mocStruct:'MS', tTr:'', tCv:'', tEnd:'', trSec:3, covers:true,
    inlets:1, outlets:1, legH:0, endBearing:'flange', seal:'gland', paintInside:true, paintSpec:'',
    extras:{}, priceOverrides:{}
  });

  /* which collapsible sections are open (remembered between sessions) */
  const OPEN_DEF = { project:false, duty:true, material:false, screw:false, build:false, extras:false, calc:false, raw:true, rates:false };
  const S = { inp:DEF(), rates:Object.assign({}, SC.DEFAULT_RATES), step:'design', open:Object.assign({}, OPEN_DEF),
              printPrices:true, R:null, B:null, C:null };

  /* ---------- storage (every access guarded) ---------- */
  const store = {
    get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };

  /* ---------- formatting ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (n, dp=0) => isFinite(n) ? Number(n).toLocaleString('en-US', {minimumFractionDigits:dp, maximumFractionDigits:dp}) : '—';
  const cur = () => S.rates.currency || 'AED';
  const money = (n, dp=0) => `${cur()} ${fmt(n, dp)}`;
  const qtyFmt = (q, unit) => fmt(q, unit === 'm' ? 2 : (q % 1 ? 1 : 0));
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };

  /* ---------- engine input from UI state ---------- */
  function engineInput(){
    const i = Object.assign({}, S.inp);
    i.Dmode = i.Dsel === 'auto' ? 'auto' : 'manual';
    i.D = i.Dsel === 'custom' ? i.Dcustom : i.Dsel;
    return i;
  }
  function recompute(){
    const i = engineInput();
    S.R = SC.design(i);
    S.B = SC.boq(i, S.R, S.rates);
    S.C = SC.cost(S.B, i, S.rates);
    store.set(LS.cur, S.inp);
    $('#projLabel').textContent = [S.inp.project || 'Untitled project', S.inp.tag].filter(Boolean).join(' · ');
  }

  /* =================================================================
     FIELD BUILDERS
     ================================================================= */
  function opts(list, val){
    return list.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
  }
  function field(k, label, o = {}){
    const v = S.inp[k];
    const help = o.help ? ` title="${esc(o.help)}"` : '';
    const lab = `<span${help}>${esc(label)}${o.help ? ' <i>ⓘ</i>' : ''}</span>`;
    const unit = o.unit ? `<span class="u">${esc(o.unit)}</span>` : '';
    if (o.type === 'sel'){
      return `<label class="f">${lab}<div class="in"><select data-k="${k}">${opts(o.options, v)}</select>${unit}</div></label>`;
    }
    if (o.type === 'chk'){
      return `<label class="f chk"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}><span${help}>${esc(label)}</span></label>`;
    }
    const type = o.type === 'text' ? 'text' : (o.type === 'date' ? 'date' : 'number');
    const ph = o.ph ? ` placeholder="${esc(o.ph)}" data-ph="${k}"` : '';
    const step = type === 'number' ? ` step="${o.step || 'any'}"${o.min != null ? ` min="${o.min}"` : ''}` : '';
    return `<label class="f${o.ph ? ' auto' : ''}">${lab}<div class="in"><input type="${type}" data-k="${k}" value="${esc(v)}"${ph}${step}>${unit}</div></label>`;
  }
  const ro = (label, id, unit) => `<label class="f ro"><span>${esc(label)}</span><div class="in"><b data-out="${id}">—</b>${unit ? `<span class="u">${unit}</span>` : ''}</div></label>`;
  /* collapsible section; `sum` is a one-line summary shown when folded (updated live via data-sum) */
  const sec = (id, title, body, sumId) =>
    `<details class="sec" data-sec="${id}"${S.open[id] ? ' open' : ''}><summary><span>${esc(title)}</span><small data-sum="${sumId || id}"></small></summary><div class="secb">${body}</div></details>`;

  const sizeOpts = () => [['auto','Auto-select (recommended)']].concat(D_.sizes.map(s => [String(s.D), `Ø${s.D} mm (${(s.D/25.4).toFixed(0)}")`])).concat([['custom','Custom diameter…']]);
  const pipeOpts = () => [['auto','Auto (by size, shaft & torque)']].concat(Object.entries(D_.pipes).map(([k,p]) => [k, `${p.label} — Ø${p.od} × ${p.t}`]));
  const shaftOpts = () => [['auto','Auto (by torque)']].concat(D_.shafts.map(s => [String(s), `Ø${s} mm`]));
  const mapOpts = (obj, f) => Object.entries(obj).map(([k,v]) => [k, f ? f(v) : v.label]);
  function materialSelect(){
    const groups = {};
    D_.materials.forEach(m => (groups[m.g] = groups[m.g] || []).push(m));
    const h = Object.entries(groups).map(([g, list]) =>
      `<optgroup label="${esc(g)}">${list.map(m => `<option value="${m.key}"${S.inp.matKey === m.key ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`).join('');
    return `<label class="f"><span>Material</span><div class="in"><select data-k="matKey">${h}<option value="custom"${S.inp.matKey === 'custom' ? ' selected' : ''}>Custom material (enter values)</option></select></div></label>`;
  }

  /* =================================================================
     TAB 1 — DESIGN  (inputs left, results right)
     ================================================================= */
  function designInputs(){
    return `<div class="card inputs">
      ${sec('duty', 'Duty', `<div class="grid">
        ${materialSelect()}
        ${field('tph','Design capacity',{unit:'t/h', help:'Use the design (maximum) rate, not the average.'})}
        ${field('L','Conveyor length (overall)',{unit:'m', help:'End plate to end plate, measured along the screw.'})}
        ${field('angle','Incline angle',{unit:'°', help:'0 for horizontal. Above ~20° consider a tubular housing.'})}
        ${field('Dsel','Screw diameter',{type:'sel', options:sizeOpts()})}
        ${S.inp.Dsel === 'custom' ? field('Dcustom','Custom diameter',{unit:'mm'}) : ''}
        ${field('trough','Trough type',{type:'sel', options:mapOpts(D_.troughTypes)})}
        ${field('mocTrough','Trough material',{type:'sel', options:mapOpts(D_.mocs)})}
        ${field('mocScrew','Screw material',{type:'sel', options:mapOpts(D_.mocs)})}
      </div>`)}
      ${sec('material', 'Material properties', `<div class="grid">
        ${field('matName','Material name (for documents)',{type:'text'})}
        ${field('rho','Bulk density (as conveyed)',{unit:'kg/m³', help:'Use the loose / aerated density for powders such as cement.'})}
        ${field('load','Trough loading class',{type:'sel', options:mapOpts(D_.loadClasses), help:'CEMA Table D. Sets fill % and the maximum allowed speed.'})}
        ${field('fillPct','Fill override',{unit:'%', ph:'', help:'Leave blank to use the loading class fill. J&H uses 30–50 %.'})}
        ${field('fm','CEMA material factor Fm',{help:'CEMA Table B material factor — drives material HP.'})}
        ${field('lam','J&H / DIN power factor λ',{help:'Power factor used by the J&H calculator (DIN 15262).'})}
        ${field('abr','Abrasiveness',{type:'sel', options:[['0','Non-abrasive'],['1','Mildly abrasive'],['2','Abrasive']]})}
        ${field('lump','Max lump size',{unit:'mm', help:'Largest particle dimension. 0 for powders.'})}
        ${field('lumpClass','Lump class',{type:'sel', options:mapOpts(D_.lumpClasses)})}
        ${field('temp','Material temperature',{unit:'°C'})}
        ${ro('Volume flow','Qv','m³/h')}
        ${ro('Lift height','H','m')}
      </div>`)}
      ${sec('screw', 'Screw, shaft, hangers & drive', `<div class="grid">
        ${field('pitchType','Pitch',{type:'sel', options:mapOpts(D_.pitches).concat([['custom','Custom pitch…']])})}
        ${S.inp.pitchType === 'custom' ? field('pitch','Custom pitch',{unit:'mm'}) : ''}
        ${field('flight','Flight type',{type:'sel', options:mapOpts(D_.flights)})}
        ${field('paddles','Mixing paddles per pitch',{type:'sel', options:[0,1,2,3,4].map(n => [String(n), n ? String(n) : 'None'])})}
        ${field('flightFab','Flight construction',{type:'sel', options:mapOpts(D_.flightFabs)})}
        ${field('tFl','Flight thickness',{unit:'mm', ph:'auto'})}
        ${field('hand','Hand',{type:'sel', options:[['RH','Right-hand'],['LH','Left-hand']]})}
        ${field('pipeMode','Centre pipe',{type:'sel', options:pipeOpts()})}
        ${field('shaftMode','Shaft diameter',{type:'sel', options:shaftOpts()})}
        ${field('shaftMat','Shaft material',{type:'sel', options:mapOpts(D_.shaftMats)})}
        ${field('hangerPolicy','Long screws',{type:'sel', options:[['hangers','Add hanger bearings as needed'],['pipe','Prefer heavier pipe (fewer hangers)']]})}
        ${field('hangerType','Hanger bearing type',{type:'sel', options:mapOpts(D_.hangerBearings)})}
        ${field('maxSection','Max one-piece screw length',{unit:'m', help:'Longest screw section you can fabricate / transport. 6 m suits standard pipe lengths.'})}
        ${field('deflRule','Deflection limit',{type:'sel', options:[['jh','J&H rule — 1 % of diameter'],['cema','CEMA Table R — 3.8 mm (CS) / 3.2 mm (SS)']]})}
        ${field('drive','Drive arrangement',{type:'sel', options:mapOpts(D_.drives, v => `${v.label} (η ${v.eff})`)})}
        ${field('margin','Extra margin on motor',{unit:'%', help:'Added on top of the higher of CEMA and DIN power before choosing the motor size.'})}
      </div>`)}
      ${sec('build', 'Construction details', `<div class="grid">
        ${field('mocStruct','Supports & drive base material',{type:'sel', options:mapOpts(D_.mocs)})}
        ${field('tTr','Trough thickness',{unit:'mm', ph:'auto'})}
        ${field('tCv','Cover thickness',{unit:'mm', ph:'auto'})}
        ${field('tEnd','End plate thickness',{unit:'mm', ph:'auto'})}
        ${field('trSec','Trough section length',{unit:'m', help:'Length of each bolted trough section (sheet length). Sets the number of joint flanges and supports.'})}
        ${field('inlets','Inlet spouts',{unit:'nos', step:1, min:0})}
        ${field('outlets','Discharge spouts',{unit:'nos', step:1, min:0})}
        ${field('legH','Support leg height (0 = feet only)',{unit:'m'})}
        ${field('endBearing','End bearings',{type:'sel', options:mapOpts(D_.endBearings)})}
        ${field('seal','Shaft seals',{type:'sel', options:mapOpts(D_.seals)})}
        ${field('paintSpec','Paint system (text for BOQ)',{type:'text'})}
        ${field('covers','Bolted covers included',{type:'chk'})}
        ${field('paintInside','Paint inside trough & screw',{type:'chk'})}
      </div>`)}
      ${sec('extras', 'Optional extras', `<div class="extras"><span class="hd"></span><span class="hd">Item</span><span class="hd">Qty</span><span class="hd">Unit price (${esc(cur())})</span>
        ${D_.extras.map(x => { const e = S.inp.extras[x.key] || {}; const dflt = x.base + x.perKw*(S.R ? S.R.motorKw : 0);
          return `<input type="checkbox" data-x="${x.key}.on"${e.on ? ' checked' : ''}><span>${esc(x.label)}</span>
          <input type="number" data-x="${x.key}.qty" value="${esc(e.qty || 1)}" min="1" step="1">
          <input type="number" data-x="${x.key}.price" value="${esc(e.price != null && e.price !== '' ? e.price : '')}" placeholder="${Math.round(dflt)}">`; }).join('')}
      </div>`)}
      ${sec('project', 'Project details', `<div class="grid">
        ${field('client','Client',{type:'text'})}
        ${field('project','Project / enquiry no.',{type:'text'})}
        ${field('tag','Equipment tag',{type:'text'})}
        ${field('preparedBy','Prepared by',{type:'text'})}
        ${field('date','Date',{type:'date'})}
        ${field('rev','Revision',{type:'text'})}
        ${field('qty','Quantity of identical conveyors',{unit:'nos', min:1, step:1})}
      </div>`)}
    </div>`;
  }

  function statusBox(R){
    const t = { ok:'Design OK', warn:'OK — check the notes', fail:'Not acceptable — see red items' }[R.status];
    return `<div class="status ${R.status}"><span class="dot"></span>${t}</div>`;
  }
  function checksList(R, onlyIssues){
    const list = onlyIssues ? R.checks.filter(c => c.lvl !== 'ok') : R.checks;
    if (!list.length) return '<p class="hint" style="margin:0">No issues.</p>';
    return `<ul class="checks">${list.map(c => `<li class="${c.lvl}">${esc(c.msg)}</li>`).join('')}</ul>`;
  }
  function resultsHtml(){
    const R = S.R, p = R.power, B = S.B, C = S.C;
    const m = (label, val, unit, small, cls) => `<div class="metric ${cls || ''}"><span>${label}</span><b>${val}</b><em>${unit || ''}</em>${small ? `<small>${small}</small>` : ''}</div>`;
    return `<div class="card">
      ${statusBox(R)}
      <div class="metrics" style="margin:12px 0">
        ${m('Screw diameter', R.Dmm, 'mm', `${(R.Dmm/25.4).toFixed(1)}" · pitch ${R.Pmm} mm`)}
        ${m('Speed', fmt(R.N, 1), 'rpm', `${fmt(R.speedPct)} % of CEMA max ${fmt(R.maxRpm)}`, R.speedPct > 100 ? 'bad' : (R.speedPct > 90 ? 'warn' : ''))}
        ${m('Motor', R.motorKw, 'kW', `need ${fmt(p.designKw, 2)} kW · ${p.governs}`)}
        ${m('Shaft / pipe', `Ø${R.shaftMm}`, `/ Ø${R.pipe.od}`, `torque ${fmt(R.Tmotor/R.shaftAllow*100)} % of rating`, R.Tmotor > R.shaftAllow ? 'bad' : '')}
        ${m('Hangers', R.hangers, 'nos', `sag ${fmt(R.defl, 1)} / ${fmt(R.deflLimitMm, 1)} mm`, R.defl > R.deflLimitMm ? 'bad' : '')}
        ${m('Weight (net)', fmt(B.totals.net), 'kg', `screw ${fmt(R.screwKg)} kg`)}
      </div>
      <div class="pricebar"><span>Selling price / unit</span><b>${money(C.sellUnit)}</b><a href="#" data-goto="boq">BOQ &amp; cost →</a></div>
      <div class="drawing" style="margin-top:12px">${drawing(R, B, S.inp)}</div>
      <h3 style="margin:14px 0 8px">Design checks</h3>${checksList(R)}
    </div>
    <div class="card"><details class="sec" data-sec="calc"${S.open.calc ? ' open' : ''}><summary><span>Calculation details</span><small>every number used — to check against J&amp;H</small></summary><div class="secb">${calcHtml()}</div></details></div>`;
  }
  function calcHtml(){
    const R = S.R, p = R.power, i = engineInput();
    const row = (a, b, c) => `<tr><td>${a}</td><td class="n">${b}</td><td class="d">${c || ''}</td></tr>`;
    return `<div class="tw"><table class="t"><thead><tr><th>Quantity</th><th class="n">Value</th><th>Basis</th></tr></thead><tbody>
      <tr class="grp"><td colspan="3">Capacity & speed</td></tr>
      ${row('Volume flow Qv', fmt(R.Qv, 2)+' m³/h', `${fmt(R.Qt,2)} t/h ÷ ${fmt(R.mat.rho)} kg/m³`)}
      ${row('Fill', fmt(R.fill*100)+' %', `loading class ${R.mat.load}`)}
      ${row('Incline capacity factor', fmt(R.kInc, 3), `${fmt(R.theta,1)}° (J&H correction)`)}
      ${row('Volume per revolution', fmt(R.vRev*1000, 2)+' litre', 'π/4·(D² − d²)·P·fill·k ÷ (CF2·CF3)')}
      ${row('Speed N', fmt(R.N, 2)+' rpm', `max ${fmt(R.maxRpm,1)} rpm (CEMA Table D)`)}
      ${row('Axial product speed', fmt(R.vAxial, 2)+' m/s', 'J&H flags > 0.6 m/s')}
      ${row('Gear ratio from 1450 rpm', fmt(R.gearRatio, 1), '4-pole motor, 50 Hz')}
      <tr class="grp"><td colspan="3">Power — CEMA (primary)</td></tr>
      ${row('Fd / Fb / Ff / Fp', `${fmt(p.Fd,1)} / ${p.Fb} / ${R.flt.ff[i.load==='15'?0:i.load==='45'?2:1]} / ${D_.paddles.fp[R.pad]}`, 'Tables L, M, J, K')}
      ${row('Friction HPf', fmt(p.HPf, 3)+' hp', 'L·N·Fd·Fb / 10⁶')}
      ${row('Material HPm', fmt(p.HPm, 3)+' hp', 'C·L·W·Fm·Ff·Fp / 10⁶')}
      ${row('Overload factor Fo', fmt(p.Fo, 2), 'Table H')}
      ${row('Lift HP', fmt(p.HPlift, 3)+' hp', `H = ${fmt(R.H,2)} m`)}
      ${row('Drive efficiency e', R.drive.eff, R.drive.label)}
      ${row('CEMA motor power', fmt(p.cemaKw, 2)+' kW', '((HPf+HPm)·Fo + lift) / e')}
      <tr class="grp"><td colspan="3">Power — DIN 15262 / J&H (check)</td></tr>
      ${row('Power at shaft', fmt(p.dinShaftKw, 2)+' kW', `Q(λ·Lh + H)/367 + D·L/20, λ = ${R.mat.lam}`)}
      ${row('At motor', fmt(p.dinKw, 2)+' kW', '÷ e')}
      ${row('J&H calculator would show', fmt(p.jhKw, 2)+' kW', 'J&H tool formula Q·L·(λ+H)/367 — for comparison')}
      <tr class="grp"><td colspan="3">Motor & torque</td></tr>
      ${row('Required power', fmt(p.designKw, 2)+' kW', `max(CEMA, DIN) × (1 + ${fmt(+i.margin||0)} %)`)}
      ${row('Selected motor', R.motorKw+' kW', 'next IEC size')}
      ${row('Running torque at screw', fmt(R.Tabs)+' N·m', 'absorbed power')}
      ${row('Torque at full motor rating', fmt(R.Tmotor)+' N·m', '9550 · kW / N (CEMA practice)')}
      ${row('Shaft allowable', fmt(R.shaftAllow)+' N·m', `Ø${R.shaftMm}, τ = ${R.sMat.tau} MPa (CEMA Table Q basis)`)}
      ${row('Pipe allowable', fmt(R.pipeAllow)+' N·m', `${R.pipe.label}, τ = ${D_.pipeTau} MPa`)}
      <tr class="grp"><td colspan="3">Deflection & lumps</td></tr>
      ${row('Flight weight', fmt(R.flight.kgm, 2)+' kg/m', `${fmt(R.flight.area,4)} m² per pitch × ${R.tFl} mm`)}
      ${row('Pipe weight', fmt(R.pipe.A*7850, 2)+' kg/m', R.pipe.label)}
      ${row('Deflection per section', fmt(R.defl, 2)+' mm', `5wL⁴/384EI, L = ${fmt(R.span,2)} m, limit ${fmt(R.deflLimitMm,1)} mm`)}
      ${row('Allowed lump', fmt(R.lumpAllow)+' mm', 'radial clearance ÷ class ratio (CEMA Table E)')}
    </tbody></table></div>`;
  }

  /* =================================================================
     TAB 2 — BOQ & COST  (weights and prices together)
     ================================================================= */
  function boqView(){
    const B = S.B, C = S.C, R = S.R;
    const ovInput = l => `<input type="number" data-ov="${esc(l.id)}" value="${l.overridden ? Math.round(l.amount) : ''}" placeholder="${fmt(l.sec === 'Fabricated items' ? l.net*l.rate : l.qty*l.unitPrice)}" class="${l.overridden ? 'ov' : ''}" title="Type a price to override (e.g. vendor quote); clear to restore">`;
    const fabLines = C.lines.filter(l => l.sec === 'Fabricated items');
    const groups = {};
    fabLines.forEach(l => (groups[l.grp] = groups[l.grp] || []).push(l));
    const grpHead = (title, kg, amt) => `<tr class="grp"><td colspan="3">${esc(title)}</td><td class="n">${kg != null ? fmt(kg) + ' kg' : ''}</td><td></td><td class="n">${fmt(amt)}</td></tr>`;
    const fabRows = Object.entries(groups).map(([g, list]) =>
      grpHead(g, list.reduce((a, l) => a + l.net, 0), list.reduce((a, l) => a + l.amount, 0)) + list.map(l =>
        `<tr><td>${esc(l.name)}<div class="d">${esc(l.spec)}</div></td><td class="n">${qtyFmt(l.qty, l.unit)}</td><td>${esc(l.unit)}</td>
          <td class="n">${fmt(l.net, 1)}</td><td class="n">${fmt(l.rate, 2)} /kg</td><td class="n">${ovInput(l)}</td></tr>`).join('')).join('');
    const otherRows = sec2 => { const list = C.lines.filter(l => l.sec === sec2);
      return grpHead(sec2, null, list.reduce((a, l) => a + l.amount, 0)) + list.map(l =>
      `<tr><td>${esc(l.name)}<div class="d">${esc(l.spec)}</div></td><td class="n">${qtyFmt(l.qty, l.unit)}</td><td>${esc(l.unit)}</td>
        <td></td><td class="n">${fmt(l.unitPrice)} /${esc(l.unit)}</td><td class="n">${ovInput(l)}</td></tr>`).join(''); };
    const rateBox = (k, label) => `<label class="rbox"><span>${label}</span><input type="number" data-r="${k}" value="${esc(S.rates[k])}" step="0.5"><em>${esc(cur())}/kg</em></label>`;
    const pct = k => `<input type="number" data-r="${k}" value="${esc(S.rates[k])}" step="0.5">`;
    const m = (label, val, unit, small) => `<div class="metric"><span>${label}</span><b>${val}</b><em>${unit}</em>${small ? `<small>${small}</small>` : ''}</div>`;
    return `
      <div class="card">
        <div class="boqhead">
          <div><h2>BOQ &amp; cost — ${esc(S.inp.tag || 'conveyor')}</h2>
          <p class="hint">Ø${R.Dmm} × ${fmt(R.L,2)} m · ${fmt(R.Qt,1)} t/h ${esc(S.inp.matName)} · ${R.motorKw} kW · ${R.nSec} screw section${R.nSec>1?'s':''}, ${R.hangers} hanger${R.hangers===1?'':'s'}, ${B.geom.nT} trough sections. Per conveyor.</p></div>
          ${statusBox(R)}
        </div>
        <div class="metrics" style="margin-bottom:12px">
          ${m('Fabricated weight', fmt(B.totals.net), 'kg', `screw ${fmt(R.screwKg)} kg · motor ${R.motorKw} kW`)}
          ${m('Direct cost', fmt(C.direct), cur(), `fab ${fmt(C.fab)} · bought ${fmt(C.bo)} · services ${fmt(C.sv)}`)}
          ${m('Selling price / unit', fmt(C.sellUnit), cur(), `${fmt(C.perKg, 2)} ${cur()}/kg`)}
          ${m(`Total × ${C.qty}`, fmt(C.sellTotal), cur(), `profit ${fmt(C.profit*C.qty)} ${cur()}`)}
        </div>
        <div class="rates-inline"><b>All-in rates (material + labour)</b>
          ${rateBox('rScrew','Screw')}${rateBox('rMach','Machined parts')}${rateBox('rTrough','Trough & casing')}${rateBox('rStruct','Supports & drive')}
        </div>
        <div class="tw"><table class="t boq"><thead><tr><th>Item / description</th><th class="n">Qty</th><th>Unit</th><th class="n">Weight kg</th><th class="n">Rate</th><th class="n">Amount ${esc(cur())}</th></tr></thead>
          <tbody>
            ${fabRows}
            ${otherRows('Bought-out items')}
            ${otherRows('Services')}
            <tr class="tot"><td colspan="3">Direct cost</td><td class="n">${fmt(B.totals.net)} kg</td><td></td><td class="n">${fmt(C.direct)}</td></tr>
          </tbody></table></div>
        <p class="hint" style="margin:8px 0 0">Amount = weight × all-in rate (stainless, Hardox and alloy shafts use the factors in Rates &amp; prices). Type in the Amount box to use your own price; clear it to go back.</p>
      </div>
      <div class="row2">
        <div class="card"><h2>Price build-up</h2>
          <table class="sumtbl">
            <tr><td>Fabricated items</td><td class="n">${fmt(C.fab)}</td></tr>
            <tr><td>Bought-out items</td><td class="n">${fmt(C.bo)}</td></tr>
            <tr><td>Services</td><td class="n">${fmt(C.sv)}</td></tr>
            <tr><td><b>Direct cost</b></td><td class="n"><b>${fmt(C.direct)}</b></td></tr>
            <tr><td>Overhead ${pct('overhead')} %</td><td class="n">${fmt(C.overhead)}</td></tr>
            <tr><td>Contingency ${pct('contingency')} %</td><td class="n">${fmt(C.contingency)}</td></tr>
            <tr><td><b>Total cost</b></td><td class="n"><b>${fmt(C.costTotal)}</b></td></tr>
            <tr><td>Profit ${pct('profit')} %</td><td class="n">${fmt(C.profit)}</td></tr>
            <tr class="big"><td>Selling price per unit (${esc(cur())})</td><td class="n">${fmt(C.sellUnit)}</td></tr>
            ${C.qty > 1 ? `<tr class="big"><td>Total × ${C.qty} units</td><td class="n">${fmt(C.sellTotal)}</td></tr>` : ''}
          </table>
          <label class="f chk" style="padding-top:12px"><input type="checkbox" id="chkPrintPrices"${S.printPrices ? ' checked' : ''}><span>Include prices when printing</span></label>
          <div class="note">Preliminary estimate (±20–25 %). Bought-out prices are budget formulas — replace motor, bearings and extras with vendor prices for a firm quotation.</div>
        </div>
        <div class="card">${sec('rates', 'Other rates & prices (saved for all projects)', ratesHtml())}</div>
      </div>`;
  }

  function ratesHtml(){
    const r = (k, label, unit, help) => `<label class="f"><span${help ? ` title="${esc(help)}"` : ''}>${esc(label)}${help ? ' <i>ⓘ</i>' : ''}</span><div class="in"><input type="number" data-r="${k}" value="${esc(S.rates[k])}" step="any"><span class="u">${unit}</span></div></label>`;
    return `<div class="grid">
        <label class="f"><span>Currency</span><div class="in"><select data-r="currency">${opts(D_.currencies.map(c => [c, c]), S.rates.currency)}</select></div></label>
        ${r('fSS304','Rate factor — SS 304', '×', 'Multiplies the all-in rate for stainless 304 parts.')}
        ${r('fSS316','Rate factor — SS 316', '×')}
        ${r('fHARDOX','Rate factor — Hardox', '×')}
        ${r('fEN19','Rate factor — EN19 alloy shafts', '×')}
        ${r('shopHr','Shop rate — assembly & test', cur()+'/h')}
        ${r('paint','Surface prep + painting', cur()+'/m²')}
        ${r('pickle','Pickling & passivation (SS)', cur()+'/m²')}
        ${r('motorA','Geared motor — fixed part A', cur(), 'Budget price = A + B × kW')}
        ${r('motorB','Geared motor — per kW part B', cur()+'/kW')}
        ${r('bolt','Bolt set (M12 Gr 8.8 HDG)', cur()+'/set')}
        ${r('gasket','Gasket strip', cur()+'/m')}
      </div>
      <div style="margin-top:12px"><button class="btn" id="btnResetRates">Reset rates to defaults</button></div>`;
  }

  /* ---------- general-arrangement sketch ---------- */
  function drawing(R, B, inp){
    const W = 940, x0 = 86, lenPx = 560, h = 64, yT = 96, yB = yT + h, yC = yT + h/2;
    const pitchPx = Math.max(9, R.P / R.L * lenPx);
    let s = '';
    s += `<rect class="tr" x="${x0}" y="${yT}" width="${lenPx}" height="${h}" rx="${inp.trough === 'tube' ? h/2 : 4}"/>`;
    const fillH = h * Math.min(0.9, R.fill*1.25);
    s += `<rect class="mt" x="${x0+2}" y="${yB - fillH}" width="${lenPx-4}" height="${fillH-2}"/>`;
    s += `<line class="ln" x1="${x0-26}" y1="${yC}" x2="${x0+lenPx+26}" y2="${yC}" stroke-width="5"/>`;
    let fp = '';
    for (let x = x0 + 4; x < x0 + lenPx - 4; x += pitchPx){
      const xe = Math.min(x + pitchPx/2, x0 + lenPx - 4);
      fp += `M${x.toFixed(1)} ${yT+4} L${xe.toFixed(1)} ${yB-4} `;
    }
    s += `<path class="fl" d="${fp}"/>`;
    s += `<line class="ln" x1="${x0}" y1="${yT-8}" x2="${x0}" y2="${yB+18}" stroke-width="4"/><line class="ln" x1="${x0+lenPx}" y1="${yT-8}" x2="${x0+lenPx}" y2="${yB+18}" stroke-width="4"/>`;
    for (let k = 1; k < R.nSec; k++){
      const hx = x0 + lenPx*k/R.nSec;
      s += `<line class="acs" x1="${hx}" y1="${yT-6}" x2="${hx}" y2="${yC}" stroke-width="2"/><rect class="ac" x="${hx-6}" y="${yC-6}" width="12" height="12" rx="2"/><text x="${hx}" y="${yT-12}" text-anchor="middle">HB</text>`;
    }
    const nIn = Math.max(0, +inp.inlets || 0), nOut = Math.max(0, +inp.outlets || 0);
    for (let i = 0; i < nIn; i++){ const ix = x0 + 18 + i*70; s += `<path class="tr" d="M${ix} ${yT} L${ix+44} ${yT} L${ix+36} ${yT-26} L${ix+8} ${yT-26} Z"/>`; }
    if (nIn) s += `<text x="${x0+40}" y="${yT-32}" text-anchor="middle">INLET${nIn>1?' ×'+nIn:''}</text>`;
    for (let i = 0; i < nOut; i++){ const ox = x0 + lenPx - 62 - i*70; s += `<path class="tr" d="M${ox} ${yB} L${ox+44} ${yB} L${ox+36} ${yB+26} L${ox+8} ${yB+26} Z"/>`; }
    if (nOut) s += `<text x="${x0+lenPx-40}" y="${yB+42}" text-anchor="middle">OUTLET${nOut>1?' ×'+nOut:''}</text>`;
    const dx = x0 + lenPx + 26;
    s += `<rect class="tr" x="${dx}" y="${yC-20}" width="34" height="40" rx="3"/><rect class="tr" x="${dx+34}" y="${yC-14}" width="52" height="28" rx="4"/><rect class="ac" x="${dx+86}" y="${yC-4}" width="8" height="8"/>`;
    s += `<text x="${dx+48}" y="${yC-28}" text-anchor="middle">${R.motorKw} kW</text>`;
    for (let k = 0; k <= B.geom.nT; k++){ const fx = x0 + lenPx*k/B.geom.nT; s += `<line class="ln" x1="${fx}" y1="${yB}" x2="${fx}" y2="${yB+18}" stroke-width="3"/>`; }
    const yd = yB + 62;
    s += `<path class="dim" d="M${x0} ${yd-6} V${yd+6} M${x0+lenPx} ${yd-6} V${yd+6} M${x0} ${yd} H${x0+lenPx}"/>`;
    s += `<text x="${x0+lenPx/2}" y="${yd-5}" text-anchor="middle">L = ${fmt(R.L, 2)} m${R.theta > 0 ? ` @ ${fmt(R.theta,1)}°` : ''}</text>`;
    s += `<path class="dim" d="M${x0-40} ${yT} H${x0-30} M${x0-40} ${yB} H${x0-30} M${x0-35} ${yT} V${yB}"/>`;
    s += `<text x="${x0-44}" y="${yC+4}" text-anchor="end">Ø${R.Dmm}</text>`;
    const cx = 860, cy = 140, r = 50, rp = Math.max(6, r*R.pipe.od/R.Dmm);
    if (inp.trough === 'tube'){
      s += `<circle class="tr" cx="${cx}" cy="${cy}" r="${r+6}"/>`;
    } else {
      const top = cy - r*1.25;
      s += `<path class="tr" d="M${cx-r-6} ${top} V${cy} A${r+6} ${r+6} 0 0 0 ${cx+r+6} ${cy} V${top}"/><path class="ln" d="M${cx-r-18} ${top} H${cx-r-6} M${cx+r+6} ${top} H${cx+r+18}" stroke-width="2"/>`;
    }
    const fy = cy + r - 2*r*R.fill;
    s += `<clipPath id="cs"><circle cx="${cx}" cy="${cy}" r="${r+5}"/></clipPath><rect class="mt" x="${cx-r-6}" y="${fy}" width="${2*r+12}" height="${cy + r + 6 - fy}" clip-path="url(#cs)"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-dasharray="4 3" class="ln"/><circle class="tr" cx="${cx}" cy="${cy}" r="${rp}"/>`;
    s += `<text x="${cx}" y="${cy+r+26}" text-anchor="middle">${fmt(R.fill*100)} % fill · ${inp.trough === 'tube' ? 'tubular' : inp.trough === 'flared' ? 'flared' : 'U-trough'}</text>`;
    return `<svg viewBox="0 0 ${W} 270" role="img" aria-label="General arrangement sketch">${s}</svg>`;
  }

  /* =================================================================
     RENDER
     ================================================================= */
  function render(){
    document.querySelectorAll('#steps button').forEach(b => b.classList.toggle('on', b.dataset.step === S.step));
    const design = S.step === 'design';
    document.querySelectorAll('details[data-sec]').forEach(d => { S.open[d.dataset.sec] = d.open; });   // keep folds as they are
    store.set(LS.open, S.open);
    $('#layout').classList.toggle('wide', !design);
    $('#layout').classList.toggle('split', design);
    $('#pane').innerHTML = design ? designInputs() : boqView();
    if (!design) $('#side').innerHTML = '';
    refresh();
  }
  function refresh(){
    const R = S.R, B = S.B, C = S.C;
    if (S.step === 'design'){
      const side = $('#side'), keep = side.scrollTop;
      side.innerHTML = resultsHtml(); side.scrollTop = keep;
    }
    const ph = { tFl:R.tFl, tTr:R.row.tTr, tCv:R.row.tCv, tEnd:R.row.tEnd, fillPct:Math.round(D_.loadClasses[R.mat.load].fill*100) };
    document.querySelectorAll('[data-ph]').forEach(el => { const k = el.dataset.ph; if (ph[k] != null) el.placeholder = `${ph[k]} (auto)`; });
    const out = { Qv:fmt(R.Qv, 2), H:fmt(R.H, 2) };
    document.querySelectorAll('[data-out]').forEach(el => { el.textContent = out[el.dataset.out] != null ? out[el.dataset.out] : '—'; });
    const i = S.inp, nExtra = D_.extras.filter(x => (i.extras[x.key] || {}).on).length;
    const sums = {
      duty: `${esc(i.matName)} · ${fmt(R.Qt,1)} t/h · ${fmt(R.L,2)} m`,
      material: `${fmt(R.mat.rho)} kg/m³ · loading ${R.mat.load} · Fm ${R.mat.fm} · λ ${R.mat.lam}`,
      screw: `pitch ${R.Pmm} · shaft Ø${R.shaftMm} · ${R.hangers} hanger${R.hangers===1?'':'s'} · ${R.motorKw} kW`,
      build: `trough ${i.tTr || R.row.tTr} mm · ${B.geom.nT} sections · ${(D_.seals[i.seal]||{}).label || ''}`,
      extras: nExtra ? `${nExtra} selected` : 'none selected',
      project: [i.client, i.project, i.tag].filter(Boolean).map(esc).join(' · ') || 'not filled in',
      rates: `${esc(cur())} · SS304 ×${S.rates.fSS304} · paint ${S.rates.paint}/m² · motor ${S.rates.motorA} + ${S.rates.motorB}/kW`
    };
    document.querySelectorAll('[data-sum]').forEach(el => { const k = el.dataset.sum; if (sums[k] != null) el.innerHTML = sums[k]; });
  }

  /* ---------- events ---------- */
  function setInp(k, v){
    S.inp[k] = v;
    if (k === 'matKey'){
      const m = D_.materials.find(x => x.key === v);
      if (m) Object.assign(S.inp, { matName:m.name, rho:m.rho, load:m.load, fm:m.fm, lam:m.lam, abr:m.abr, fillPct:'' });
    }
  }
  const layout = $('#layout');
  layout.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.k && t.tagName === 'INPUT' && t.type !== 'checkbox'){ setInp(t.dataset.k, t.value); recompute(); refresh(); }
  });
  layout.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.k){
      setInp(t.dataset.k, t.type === 'checkbox' ? t.checked : t.value);
      if (t.tagName === 'SELECT' || t.type === 'checkbox'){ recompute(); render(); }
    } else if (t.dataset.r){
      S.rates[t.dataset.r] = t.tagName === 'SELECT' ? t.value : (t.value === '' ? SC.DEFAULT_RATES[t.dataset.r] : parseFloat(t.value));
      store.set(LS.rates, S.rates); recompute(); render();
    } else if (t.dataset.ov){
      if (t.value === '') delete S.inp.priceOverrides[t.dataset.ov]; else S.inp.priceOverrides[t.dataset.ov] = t.value;
      recompute(); render();
    } else if (t.dataset.x){
      const [key, prop] = t.dataset.x.split('.');
      const e2 = S.inp.extras[key] = Object.assign({}, S.inp.extras[key] || {});
      e2[prop] = t.type === 'checkbox' ? t.checked : t.value;
      recompute(); render();
    } else if (t.id === 'chkPrintPrices'){ S.printPrices = t.checked; }
  });
  layout.addEventListener('toggle', e => {
    const d = e.target; if (d.dataset && d.dataset.sec){ S.open[d.dataset.sec] = d.open; store.set(LS.open, S.open); }
  }, true);
  layout.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g){ e.preventDefault(); go(g.dataset.goto); }
    if (e.target.id === 'btnResetRates'){ S.rates = Object.assign({}, SC.DEFAULT_RATES); store.set(LS.rates, S.rates); recompute(); render(); toast('Rates reset to defaults'); }
  });
  function go(step){ S.step = step; store.set(LS.step, step); render(); window.scrollTo(0, 0); }
  $('#steps').addEventListener('click', e => { const b = e.target.closest('button[data-step]'); if (b) go(b.dataset.step); });

  /* ---------- project library ---------- */
  const projName = () => [S.inp.project || 'Untitled', S.inp.tag].filter(Boolean).join(' / ');
  function download(name, text, type){
    const blob = new Blob([text], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const safe = s => String(s).replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'project';
  $('#btnNew').addEventListener('click', () => {
    if (!confirm('Start a new project? Unsaved changes to the current project will be lost.')) return;
    S.inp = DEF(); recompute(); go('design');
  });
  $('#btnSave').addEventListener('click', () => {
    const lib = store.get(LS.lib, []).filter(p => p.name !== projName());
    lib.push({ name:projName(), savedAt:new Date().toISOString(), inp:S.inp });
    lib.sort((a, b) => a.name.localeCompare(b.name));
    store.set(LS.lib, lib);
    toast(`Saved “${projName()}”. Use Open → Download for a file backup.`);
  });
  function listProjects(){
    const lib = store.get(LS.lib, []);
    $('#projList').innerHTML = lib.length ? lib.map((p, i) => `<div class="p"><b>${esc(p.name)}</b><small>${esc((p.savedAt||'').slice(0,10))}</small>
      <button type="button" class="btn small" data-load="${i}">Open</button><button type="button" class="btn small" data-dl="${i}">Download</button><button type="button" class="btn small" data-del="${i}">Delete</button></div>`).join('')
      : '<p class="hint">No saved projects in this browser yet. Use Save, or import a file.</p>';
  }
  $('#btnOpen').addEventListener('click', () => { listProjects(); $('#dlgOpen').showModal(); });
  $('#projList').addEventListener('click', e => {
    const lib = store.get(LS.lib, []);
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.load != null){ S.inp = Object.assign(DEF(), lib[+b.dataset.load].inp); recompute(); $('#dlgOpen').close(); go('design'); toast('Project opened'); }
    if (b.dataset.dl != null){ const p = lib[+b.dataset.dl]; download(`ScrewConveyor_${safe(p.name)}.json`, JSON.stringify({ type:'sce-project', version:1, project:p }, null, 2), 'application/json'); }
    if (b.dataset.del != null && confirm(`Delete “${lib[+b.dataset.del].name}” from this browser?`)){ lib.splice(+b.dataset.del, 1); store.set(LS.lib, lib); listProjects(); }
  });
  $('#btnExportAll').addEventListener('click', () => download(`ScrewConveyor_AllProjects_${today()}.json`,
    JSON.stringify({ type:'sce-library', version:1, rates:S.rates, projects:store.get(LS.lib, []) }, null, 2), 'application/json'));
  $('#fileImport').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        const lib = store.get(LS.lib, []);
        const add = p => { const i = lib.findIndex(x => x.name === p.name); if (i >= 0) lib[i] = p; else lib.push(p); };
        if (d.type === 'sce-project') add(d.project);
        else if (d.type === 'sce-library'){ (d.projects || []).forEach(add); if (d.rates && confirm('Also import the rates saved in this file?')){ S.rates = Object.assign({}, SC.DEFAULT_RATES, d.rates); store.set(LS.rates, S.rates); } }
        else throw new Error('not a Screw Conveyor Estimator file');
        lib.sort((a, b) => a.name.localeCompare(b.name)); store.set(LS.lib, lib); listProjects(); toast('Imported');
      } catch(err){ alert('Import failed: ' + err.message); }
      e.target.value = '';
    };
    rd.readAsText(f);
  });

  /* ---------- Excel export (BOQ, purchase list, design) ---------- */
  $('#btnXlsx').addEventListener('click', () => {
    try {
      const x = SC.exportBoqXlsx(S);
      const a = document.createElement('a'); a.href = URL.createObjectURL(x.blob); a.download = x.filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast('Excel BOQ downloaded');
    } catch(err){ alert('Excel export failed: ' + err.message); }
  });

  /* ---------- print report ---------- */
  $('#btnPrint').addEventListener('click', () => { $('#report').innerHTML = reportHtml(S.printPrices); window.print(); });
  function reportHtml(withPrices){
    const R = S.R, B = S.B, C = S.C, i = S.inp, p = R.power;
    const kv = list => `<table>${list.map(([a, b]) => `<tr><th style="width:45%">${esc(a)}</th><td>${b}</td></tr>`).join('')}</table>`;
    const fabRows = B.items.map(it => { const l = C.lines.find(x => x.id === 'F:'+it.name);
      return `<tr><td>${esc(it.name)}</td><td>${esc(it.spec)}</td><td class="n">${qtyFmt(it.qty, it.unit)} ${esc(it.unit)}</td><td class="n">${fmt(it.net,1)}</td>${withPrices ? `<td class="n">${fmt(l.rate,2)}</td><td class="n">${fmt(l.amount)}</td>` : ''}</tr>`; }).join('');
    const other = C.lines.filter(l => l.sec !== 'Fabricated items').map(l =>
      `<tr><td>${esc(l.name)}</td><td>${esc(l.spec)}</td><td class="n">${qtyFmt(l.qty, l.unit)} ${esc(l.unit)}</td>${withPrices ? `<td class="n">${fmt(l.amount)}</td>` : ''}</tr>`).join('');
    return `
      <h1>Screw Conveyor — Preliminary Design, BOQ${withPrices ? ' & Estimate' : ''}</h1>
      <div class="muted">${esc(i.client || '')}${i.project ? ' · ' + esc(i.project) : ''}${i.tag ? ' · Tag ' + esc(i.tag) : ''} · ${esc(i.date)} · Rev ${esc(i.rev)}${i.preparedBy ? ' · Prepared by ' + esc(i.preparedBy) : ''}</div>
      <h2>Design basis & results</h2>
      <div class="two">
        ${kv([['Material', esc(i.matName)], ['Bulk density', fmt(R.mat.rho)+' kg/m³'], ['Capacity', fmt(R.Qt,1)+' t/h ('+fmt(R.Qv,1)+' m³/h)'], ['Length / incline', fmt(R.L,2)+' m @ '+fmt(R.theta,1)+'°'],
              ['Loading class / fill', R.mat.load+' / '+fmt(R.fill*100)+' %'], ['Fm / λ', R.mat.fm+' / '+R.mat.lam], ['Max lump', R.lump ? R.lump+' mm (allow '+fmt(R.lumpAllow)+')' : '—'], ['Quantity', C.qty+' nos']])}
        ${kv([['Screw', 'Ø'+R.Dmm+' × '+R.Pmm+' pitch, '+R.tFl+' mm '+esc(R.fab.label.split(' (')[0].toLowerCase())+' flights'], ['Speed', fmt(R.N,1)+' rpm ('+fmt(R.speedPct)+' % of max)'],
              ['Power CEMA / DIN', fmt(p.cemaKw,2)+' / '+fmt(p.dinKw,2)+' kW'], ['Motor', R.motorKw+' kW, '+esc(R.drive.label)], ['Shaft', 'Ø'+R.shaftMm+' '+esc(R.sMat.label)+' — '+fmt(R.Tmotor/R.shaftAllow*100)+' % torque'],
              ['Centre pipe', esc(R.pipe.label)+' (Ø'+R.pipe.od+' × '+R.pipe.t+')'], ['Hangers / sections', R.hangers+' / '+R.nSec+' × '+fmt(R.span,2)+' m'], ['Deflection', fmt(R.defl,1)+' mm (limit '+fmt(R.deflLimitMm,1)+')']])}
      </div>
      ${R.checks.filter(c => c.lvl !== 'ok').length ? `<p>${R.checks.filter(c => c.lvl !== 'ok').map(c => `<span class="${c.lvl === 'fail' ? 'bad' : 'warn'}">● ${esc(c.msg)}</span>`).join('<br>')}</p>` : ''}
      <div class="drawing" style="margin-top:8px">${drawing(R, B, i)}</div>
      <h2>Fabrication BOQ (per conveyor)</h2>
      <table><tr><th>Item</th><th>Description</th><th class="n">Qty</th><th class="n">Weight kg</th>${withPrices ? `<th class="n">Rate /kg</th><th class="n">${esc(cur())}</th>` : ''}</tr>${fabRows}
      <tr><th colspan="3">Total fabricated</th><th class="n">${fmt(B.totals.net,1)}</th>${withPrices ? `<th></th><th class="n">${fmt(C.fab)}</th>` : ''}</tr></table>
      <h2>Bought-out items & services</h2>
      <table><tr><th>Item</th><th>Specification</th><th class="n">Qty</th>${withPrices ? `<th class="n">${esc(cur())}</th>` : ''}</tr>${other}</table>
      ${withPrices ? `<h2>Price build-up (${esc(cur())})</h2>
      <table style="width:55%">${[['Fabricated items', C.fab], ['Bought-out items', C.bo], ['Services', C.sv], ['Direct cost', C.direct], ['Overhead '+S.rates.overhead+' %', C.overhead],
        ['Contingency '+S.rates.contingency+' %', C.contingency], ['Profit '+S.rates.profit+' %', C.profit], ['Selling price per unit', C.sellUnit]].concat(C.qty > 1 ? [['Total × '+C.qty, C.sellTotal]] : [])
        .map(([a, b]) => `<tr><th>${a}</th><td class="n">${fmt(b)}</td></tr>`).join('')}</table>` : ''}
      <p class="muted" style="margin-top:12px">Preliminary estimate for budgeting only (±20–25 %). Design by CEMA 350 method with DIN 15262 / J&H power check. Confirm with detailed design and vendor quotations before order.</p>`;
  }

  /* ---------- start ---------- */
  S.inp = Object.assign(DEF(), store.get(LS.cur, {}));
  S.inp.extras = S.inp.extras || {}; S.inp.priceOverrides = S.inp.priceOverrides || {};
  S.rates = Object.assign({}, SC.DEFAULT_RATES, store.get(LS.rates, {}));
  S.open = Object.assign({}, OPEN_DEF, store.get(LS.open, {}));
  S.step = store.get(LS.step, 'design') === 'boq' ? 'boq' : 'design';
  recompute();
  render();
  window.SCE = S;   // for debugging in the browser console
})();
