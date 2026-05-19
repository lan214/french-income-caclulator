/**
 * app.js — UI layer: charts, DOM updates, event wiring.
 *
 * Depends on: Chart.js (global), CALC (from calculator.js)
 * No business logic — all numbers come from CALC.*.
 *
 * Crosshair sync strategy
 * ───────────────────────
 * Canonical value: monthly gross (€/month).
 * - Monthly chart x-axis: monthly gross  → range [0, MAX_GROSS]
 * - Annual  chart x-axis: annual  gross  → range [0, MAX_GROSS × 12]
 * syncCrosshairs(monthlyGross) converts to the correct pixel for each chart.
 * Mouse handlers normalize the raw x value back to monthly gross.
 */

// ================================================================
// DATASET BUILDERS
// ================================================================

function buildMonthlyDatasets(family, isCadre, includeAids) {
  const points = CALC.generateChartPoints(family, isCadre, includeAids);
  return [
    {
      label: 'Salaire net (cotisations)',
      data: points.map(p => ({ x: p.gross, y: p.net })),
      borderColor: '#c99e71', borderWidth: 1.5, pointRadius: 0,
      tension: 0.3, fill: false, order: 3,
    },
    {
      label: 'Net après impôt',
      data: points.map(p => ({ x: p.gross, y: p.netAfterIR })),
      borderColor: '#52ab5b', borderWidth: 1.5, pointRadius: 0,
      tension: 0.3, fill: false, order: 2,
    },
    {
      label: includeAids ? 'Revenu total (avec aides)' : 'Revenu total',
      data: points.map(p => ({ x: p.gross, y: p.total })),
      borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.06)',
      borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, order: 1,
    },
  ];
}

function buildAnnualDatasets(family, isCadre, includeAids) {
  const points = CALC.generateChartPoints(family, isCadre, includeAids);
  return [
    {
      label: 'Salaire net (cotisations)',
      data: points.map(p => ({ x: p.gross * 12, y: p.net * 12 })),
      borderColor: '#c99e71', borderWidth: 1.5, pointRadius: 0,
      tension: 0.3, fill: false, order: 3,
    },
    {
      label: 'Net après impôt',
      data: points.map(p => ({ x: p.gross * 12, y: p.netAfterIR * 12 })),
      borderColor: '#52ab5b', borderWidth: 1.5, pointRadius: 0,
      tension: 0.3, fill: false, order: 2,
    },
    {
      label: includeAids ? 'Revenu total (avec aides)' : 'Revenu total',
      data: points.map(p => ({ x: p.gross * 12, y: p.total * 12 })),
      borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.06)',
      borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, order: 1,
    },
  ];
}

// ================================================================
// CROSSHAIR PLUGIN
// ================================================================

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (chart._crosshairX == null) return;
    const { ctx, chartArea } = chart;
    ctx.save();

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(chart._crosshairX, chartArea.top);
    ctx.lineTo(chart._crosshairX, chartArea.bottom);
    ctx.strokeStyle = 'rgba(99,102,241,0.4)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    const ds = chart.data.datasets[2];
    if (ds && chart._crosshairIdx != null) {
      const cIdx = Math.max(0, Math.min(ds.data.length - 1, chart._crosshairIdx));
      const yPx  = chart.scales.y.getPixelForValue(ds.data[cIdx].y);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(chart._crosshairX, yPx, 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#6366f1';
      ctx.strokeStyle = 'white';
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  },
};

Chart.register(crosshairPlugin);

// ================================================================
// CHART OPTIONS FACTORY
// ================================================================

function makeChartOptions({ xMax, xTitle, xTickFmt, yTickFmt }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend:  { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        type: 'linear', min: 0, max: xMax,
        title: { display: true, text: xTitle, color: '#9ca3af', font: { size: 12 } },
        ticks: { callback: xTickFmt, color: '#9ca3af', maxTicksLimit: 8 },
        grid:   { color: '#f3f4f6' },
        border: { color: '#e5e7eb' },
      },
      y: {
        title: { display: true, text: 'Revenu (€)', color: '#9ca3af', font: { size: 12 } },
        ticks: { callback: yTickFmt, color: '#9ca3af' },
        grid:   { color: '#f3f4f6' },
        border: { color: '#e5e7eb' },
      },
    },
  };
}

const kEur  = v => Math.abs(v) >= 10000
  ? (v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k€'
  : v.toLocaleString('fr-FR') + ' €';

const stdEur = v => v.toLocaleString('fr-FR') + ' €';

// ================================================================
// CHART INSTANCES
// ================================================================

const monthlyChart = new Chart(
  document.getElementById('monthlyCanvas').getContext('2d'),
  {
    type: 'line',
    data: { datasets: [] },
    options: makeChartOptions({
      xMax:     CALC.MAX_GROSS,
      xTitle:   'Salaire brut mensuel (€)',
      xTickFmt: stdEur,
      yTickFmt: stdEur,
    }),
  }
);

const annualChart = new Chart(
  document.getElementById('annualCanvas').getContext('2d'),
  {
    type: 'line',
    data: { datasets: [] },
    options: makeChartOptions({
      xMax:     CALC.MAX_GROSS * 12,
      xTitle:   'Salaire brut annuel (€)',
      xTickFmt: kEur,
      yTickFmt: kEur,
    }),
  }
);

// ================================================================
// CROSSHAIR SYNC
// ================================================================

function syncCrosshairs(monthlyGross) {
  const idx = Math.round(monthlyGross / CALC.STEP);

  if (monthlyChart.chartArea) {
    monthlyChart._crosshairX   = monthlyChart.scales.x.getPixelForValue(monthlyGross);
    monthlyChart._crosshairIdx = idx;
    monthlyChart.update('none');
  }

  if (annualChart.chartArea) {
    annualChart._crosshairX   = annualChart.scales.x.getPixelForValue(monthlyGross * 12);
    annualChart._crosshairIdx = idx;
    annualChart.update('none');
  }
}

function clearCrosshairs() {
  for (const chart of [monthlyChart, annualChart]) {
    chart._crosshairX   = null;
    chart._crosshairIdx = null;
    chart.update('none');
  }
}

// ================================================================
// MOUSE EVENTS
// ================================================================

function attachMouseEvents(chart, toMonthlyGross) {
  chart.canvas.addEventListener('mousemove', (e) => {
    const rect = chart.canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const ca   = chart.chartArea;
    if (!ca) return;

    if (x >= ca.left && x <= ca.right) {
      const raw          = chart.scales.x.getValueForPixel(x);
      const monthlyGross = Math.max(0, Math.min(CALC.MAX_GROSS, toMonthlyGross(raw)));
      syncCrosshairs(monthlyGross);
      renderDetails(monthlyGross);
    } else {
      clearCrosshairs();
      clearDetails();
    }
  });

  chart.canvas.addEventListener('mouseleave', () => {
    clearCrosshairs();
    clearDetails();
  });
}

attachMouseEvents(monthlyChart, raw => raw);
attachMouseEvents(annualChart,  raw => raw / 12);

// ================================================================
// CHILDREN AGES UI
// ================================================================

function updateChildrenUI(nbChildren) {
  const section = document.getElementById('childrenAgesSection');
  const existing = section.querySelectorAll('.child-age-field');

  for (let i = existing.length; i < nbChildren; i++) {
    const div = document.createElement('div');
    div.className = 'child-age-field field';
    div.innerHTML = `<label>Enfant ${i + 1}</label>
      <input type="number" id="childAge${i}" value="5" min="0" max="21" step="1">`;
    div.querySelector('input').addEventListener('input', rebuild);
    section.appendChild(div);
  }

  const all = section.querySelectorAll('.child-age-field');
  for (let i = all.length - 1; i >= nbChildren; i--) {
    all[i].remove();
  }

  section.style.display = nbChildren > 0 ? 'flex' : 'none';
}

// ================================================================
// DETAILS PANELS
// ================================================================

document.getElementById('cotToggle').addEventListener('click', () => {
  document.getElementById('cotBlock').classList.toggle('open');
});
document.getElementById('aidsToggle').addEventListener('click', () => {
  document.getElementById('aidsBlock').classList.toggle('open');
});

function fmtEur(v)     { return Math.round(v).toLocaleString('fr-FR') + ' €'; }
function fmtPct(r)     { return (r * 100).toFixed(1) + ' %'; }
function placeholder() { return '<span class="placeholder">—</span>'; }

// ── Read controls ───────────────────────────────────────────────
function getInputs() {
  const adultsBtn = document.querySelector('#adultsToggle .toggle-btn.active');
  const adults    = adultsBtn ? parseInt(adultsBtn.dataset.val) : 1;
  const isDualIncome = adults === 2 && (document.getElementById('dualIncome')?.checked ?? true);
  const nbChildren   = Math.max(0, Math.min(10, parseInt(document.getElementById('nbChildren').value) || 0));

  const childrenAges = [];
  for (let i = 0; i < nbChildren; i++) {
    const el = document.getElementById(`childAge${i}`);
    childrenAges.push(el ? Math.max(0, Math.min(21, parseInt(el.value) || 0)) : 0);
  }

  return {
    family:      { adults, isDualIncome, childrenAges },
    isCadre:     document.getElementById('status').value === 'cadre',
    includeAids: document.getElementById('includeAids').checked,
  };
}

// ── Render both panels ──────────────────────────────────────────
function renderDetails(grossRaw) {
  const gross = Math.round(grossRaw / CALC.STEP) * CALC.STEP;
  const { family, isCadre, includeAids } = getInputs();
  const r = CALC.calculate(gross, family, isCadre, includeAids);
  const b = r.breakdown;

  // ── RIGHT panel — monthly ───────────────────────────────────
  setText('dGross',        fmtEur(gross));
  setText('dCot',          '−' + fmtEur(r.totalCotisations));
  setText('dNet',          fmtEur(r.net));
  setText('dNetImposable', fmtEur(r.netImposable));
  setText('dTax',          r.monthlyIR > 0.5 ? '−' + fmtEur(r.monthlyIR) : fmtEur(0));
  setText('dRateEff',      fmtPct(r.effectiveRate));
  setText('dRateTMI',      fmtPct(r.marginalRate));
  setText('dTotal',        fmtEur(r.total));

  // Aids total + expandable breakdown
  setText('dAids', r.aide > 0.5 ? '+' + fmtEur(r.aide) : fmtEur(0));
  const aidsLines = [
    { label: 'RSA',                     val: r.rsa },
    { label: "Prime d'activité",         val: r.primeActivite },
    { label: 'Allocations familiales',   val: r.af },
    { label: 'PAJE — alloc. de base',    val: r.paje },
    { label: 'Alloc. rentrée scolaire',  val: r.ars,
      sub: 'moy. mensuelle (versée en sept.)' },
    { label: 'Complément familial',      val: r.cf },
  ].filter(l => l.val > 0.01);

  document.getElementById('aidsList').innerHTML = aidsLines.map(l => `
    <div class="cot-row">
      <div>
        <span class="cot-row-label">${l.label}</span>
        ${l.sub ? `<span class="cot-row-sub">${l.sub}</span>` : ''}
      </div>
      <span class="cot-row-val" style="color:#22c55e">+${fmtEur(l.val)}</span>
    </div>
  `).join('');

  // Cotisations breakdown
  const cotLines = [
    {
      label: 'Vieillesse — CNAV',
      val:   b.vieillesse_plaf + b.vieillesse_dep,
      sub:   `plaf. ${fmtEur(b.vieillesse_plaf)} + déplaf. ${fmtEur(b.vieillesse_dep)}`,
    },
    {
      label: 'AGIRC-ARRCO',
      val:   b.agirc_t1 + b.agirc_t2,
      sub:   gross > CALC.PMSS
        ? `T1 ${fmtEur(b.agirc_t1)} + T2 ${fmtEur(b.agirc_t2)}`
        : 'T1 uniquement',
    },
    {
      label: 'CEG / CET',
      val:   b.ceg_t1 + b.ceg_t2 + b.cet,
      sub:   gross > CALC.PMSS
        ? `CEG ${fmtEur(b.ceg_t1 + b.ceg_t2)} + CET ${fmtEur(b.cet)}`
        : 'CEG T1 uniquement',
    },
    { label: 'APEC (cadres)',        val: b.apec,                  sub: '≤ 4×PMSS · 0,024 %' },
    { label: 'CSG déductible',       val: b.csg_ded,               sub: '6,80 % × 98,25 % brut' },
    { label: 'CSG non-déd. + CRDS', val: b.csg_non_ded + b.crds, sub: '2,40 % + 0,50 % — non déductibles IR' },
  ];

  document.getElementById('cotList').innerHTML = cotLines
    .filter(l => l.val > 0.005)
    .map(l => `
      <div class="cot-row">
        <div>
          <span class="cot-row-label">${l.label}</span>
          ${l.sub ? `<span class="cot-row-sub">${l.sub}</span>` : ''}
        </div>
        <span class="cot-row-val">−${fmtEur(l.val)}</span>
      </div>
    `).join('');

  // ── LEFT panel — annual ─────────────────────────────────────
  setText('aGross',        fmtEur(gross * 12));
  setText('aCot',          '−' + fmtEur(r.totalCotisations * 12));
  setText('aNet',          fmtEur(r.net * 12));
  setText('aNetImposable', fmtEur(r.netImposable * 12));
  setText('aTax',          r.annualIR > 0.5 ? '−' + fmtEur(r.annualIR) : fmtEur(0));
  setText('aRateEff',      fmtPct(r.effectiveRate));
  setText('aAids',         r.aide * 12 > 0.5 ? '+' + fmtEur(r.aide * 12) : fmtEur(0));
  setText('aTotal',        fmtEur(r.total * 12));

  // SMIC badge
  const badge = document.getElementById('grossBadge');
  if (Math.abs(gross - CALC.SMIC_GROSS) <= CALC.STEP / 2) {
    badge.textContent   = 'SMIC janv. 2026';
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function clearDetails() {
  const ph = placeholder();
  ['dGross','dCot','dNet','dNetImposable','dTax','dRateEff','dRateTMI','dAids','dTotal',
   'aGross','aCot','aNet','aNetImposable','aTax','aRateEff','aAids','aTotal']
    .forEach(id => setHTML(id, ph));
  document.getElementById('cotList').innerHTML  = '';
  document.getElementById('aidsList').innerHTML = '';
  document.getElementById('grossBadge').style.display = 'none';
}

function setText(id, v) { document.getElementById(id).textContent = v; }
function setHTML(id, v) { document.getElementById(id).innerHTML   = v; }

// ================================================================
// REBUILD — called when any control changes
// ================================================================

function rebuild() {
  const { family, isCadre, includeAids } = getInputs();
  const nbParts = CALC.calcNbParts(family);

  // Update computed QF display
  document.getElementById('nbPartsDisplay').textContent =
    nbParts.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Show/hide aids rows in both panels
  document.getElementById('aidsRow').style.display      = includeAids ? '' : 'none';
  document.getElementById('aidsDivider').style.display  = includeAids ? '' : 'none';
  document.getElementById('aAidsRow').style.display     = includeAids ? '' : 'none';
  document.getElementById('aAidsDivider').style.display = includeAids ? '' : 'none';

  monthlyChart.data.datasets = buildMonthlyDatasets(family, isCadre, includeAids);
  annualChart.data.datasets  = buildAnnualDatasets(family, isCadre, includeAids);
  monthlyChart.update();
  annualChart.update();

  document.getElementById('legend').innerHTML = monthlyChart.data.datasets.map(ds => `
    <div class="legend-item">
      <div class="legend-line" style="background:${ds.borderColor}"></div>
      <span>${ds.label}</span>
    </div>
  `).join('');
}

// ================================================================
// EVENT LISTENERS + BOOT
// ================================================================

// Adults toggle
document.querySelectorAll('#adultsToggle .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#adultsToggle .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('dualIncomeField').style.display =
      parseInt(btn.dataset.val) === 2 ? '' : 'none';
    rebuild();
  });
});

// Children count
document.getElementById('nbChildren').addEventListener('input', () => {
  const n = Math.max(0, Math.min(10, parseInt(document.getElementById('nbChildren').value) || 0));
  updateChildrenUI(n);
  rebuild();
});

// Other controls
document.getElementById('dualIncome').addEventListener('change', rebuild);
document.getElementById('status').addEventListener('change',     rebuild);
document.getElementById('includeAids').addEventListener('change', rebuild);

rebuild();
