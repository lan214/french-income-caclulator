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

function buildMonthlyDatasets(nbParts, isCadre, includeAids) {
  const points = CALC.generateChartPoints(nbParts, isCadre, includeAids);
  return [
    {
      label: 'Salaire net (cotisations)',
      data: points.map(p => ({ x: p.gross, y: p.net })),
      borderColor: '#d1d5db', borderWidth: 1.5, pointRadius: 0,
      tension: 0.3, fill: false, order: 3,
    },
    {
      label: 'Net après impôt',
      data: points.map(p => ({ x: p.gross, y: p.netAfterIR })),
      borderColor: '#94a3b8', borderWidth: 1.5, pointRadius: 0,
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

function buildAnnualDatasets(nbParts, isCadre, includeAids) {
  const points = CALC.generateChartPoints(nbParts, isCadre, includeAids);
  return [
    {
      label: 'Salaire net (cotisations)',
      data: points.map(p => ({ x: p.gross * 12, y: p.net * 12 })),
      borderColor: '#d1d5db', borderWidth: 1.5, pointRadius: 0,
      tension: 0.3, fill: false, order: 3,
    },
    {
      label: 'Net après impôt',
      data: points.map(p => ({ x: p.gross * 12, y: p.netAfterIR * 12 })),
      borderColor: '#94a3b8', borderWidth: 1.5, pointRadius: 0,
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
// CROSSHAIR PLUGIN  (registered once, works on any Chart instance)
// ================================================================

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (chart._crosshairX == null) return;
    const { ctx, chartArea } = chart;
    ctx.save();

    // Dashed vertical rule
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(chart._crosshairX, chartArea.top);
    ctx.lineTo(chart._crosshairX, chartArea.bottom);
    ctx.strokeStyle = 'rgba(99,102,241,0.4)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Dot on the "total" line (dataset index 2)
    // _crosshairIdx is the dataset array index (same for both charts)
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
// All sync is driven by the canonical monthly gross value.
// Each chart independently converts to its own pixel coordinate.
// ================================================================

function syncCrosshairs(monthlyGross) {
  const idx = Math.round(monthlyGross / CALC.STEP);

  // Monthly chart: x-axis is monthly gross
  if (monthlyChart.chartArea) {
    monthlyChart._crosshairX   = monthlyChart.scales.x.getPixelForValue(monthlyGross);
    monthlyChart._crosshairIdx = idx;
    monthlyChart.update('none');
  }

  // Annual chart: x-axis is annual gross (monthly × 12)
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
// Each canvas normalises its raw x value back to monthly gross,
// then calls the shared sync + render functions.
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

// Monthly chart: raw value IS monthly gross
attachMouseEvents(monthlyChart, raw => raw);
// Annual chart: raw value is annual gross → divide by 12
attachMouseEvents(annualChart,  raw => raw / 12);

// ================================================================
// DETAILS PANELS — rendering
// Left panel  → annual values  (IDs prefixed with "a")
// Right panel → monthly values (IDs prefixed with "d")
// ================================================================

document.getElementById('cotToggle').addEventListener('click', () => {
  document.getElementById('cotBlock').classList.toggle('open');
});

// ── Formatting helpers ──────────────────────────────────────────
function fmtEur(v)     { return Math.round(v).toLocaleString('fr-FR') + ' €'; }
function fmtPct(r)     { return (r * 100).toFixed(1) + ' %'; }
function placeholder() { return '<span class="placeholder">—</span>'; }

// ── Read controls ───────────────────────────────────────────────
function getInputs() {
  return {
    nbParts:     Math.max(0.5, parseFloat(document.getElementById('nbParts').value) || 1),
    isCadre:     document.getElementById('status').value === 'cadre',
    includeAids: document.getElementById('includeAids').checked,
  };
}

// ── Render both panels ──────────────────────────────────────────
function renderDetails(grossRaw) {
  const gross = Math.round(grossRaw / CALC.STEP) * CALC.STEP;
  const { nbParts, isCadre, includeAids } = getInputs();
  const r = CALC.calculate(gross, nbParts, isCadre, includeAids);
  const b = r.breakdown;

  // ── RIGHT panel — monthly values ────────────────────────────
  setText('dGross',   fmtEur(gross));
  setText('dCot',     '−' + fmtEur(r.totalCotisations));
  setText('dNet',          fmtEur(r.net));
  setText('dNetImposable', fmtEur(r.netImposable));
  setText('dTax',     r.monthlyIR > 0.5 ? '−' + fmtEur(r.monthlyIR) : fmtEur(0));
  setText('dRateEff', fmtPct(r.effectiveRate));
  setText('dRateTMI', fmtPct(r.marginalRate));
  setText('dAids',    r.aide > 0.5 ? '+' + fmtEur(r.aide) : fmtEur(0));
  setText('dTotal',   fmtEur(r.total));

  // Cotisations breakdown (right panel only)
  const lines = [
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

  document.getElementById('cotList').innerHTML = lines
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

  // ── LEFT panel — annual values ──────────────────────────────
  setText('aGross',   fmtEur(gross * 12));
  setText('aCot',     '−' + fmtEur(r.totalCotisations * 12));
  setText('aNet',          fmtEur(r.net * 12));
  setText('aNetImposable', fmtEur(r.netImposable * 12));
  setText('aTax',     r.annualIR > 0.5 ? '−' + fmtEur(r.annualIR) : fmtEur(0));
  setText('aRateEff', fmtPct(r.effectiveRate));
  setText('aAids',    r.aide * 12 > 0.5 ? '+' + fmtEur(r.aide * 12) : fmtEur(0));
  setText('aTotal',   fmtEur(r.total * 12));

  // SMIC badge (monthly panel only)
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
  document.getElementById('cotList').innerHTML        = '';
  document.getElementById('grossBadge').style.display = 'none';
}

// ── DOM helpers ─────────────────────────────────────────────────
function setText(id, v) { document.getElementById(id).textContent = v; }
function setHTML(id, v) { document.getElementById(id).innerHTML   = v; }

// ================================================================
// REBUILD — called when any control changes
// ================================================================

function rebuild() {
  const { nbParts, isCadre, includeAids } = getInputs();

  // Show / hide aids rows in both panels
  document.getElementById('aidsRow').style.display      = includeAids ? '' : 'none';
  document.getElementById('aidsDivider').style.display  = includeAids ? '' : 'none';
  document.getElementById('aAidsRow').style.display     = includeAids ? '' : 'none';
  document.getElementById('aAidsDivider').style.display = includeAids ? '' : 'none';

  monthlyChart.data.datasets = buildMonthlyDatasets(nbParts, isCadre, includeAids);
  annualChart.data.datasets  = buildAnnualDatasets(nbParts, isCadre, includeAids);
  monthlyChart.update();
  annualChart.update();

  // Legend from monthly chart (labels are identical on both)
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

document.getElementById('nbParts').addEventListener('input',  rebuild);
document.getElementById('status').addEventListener('change',  rebuild);
document.getElementById('includeAids').addEventListener('change', rebuild);

rebuild();
