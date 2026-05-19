/**
 * app.js — UI layer: chart, DOM updates, event wiring.
 *
 * Depends on: Chart.js (global), CALC (from calculator.js)
 * No business logic here — all numbers come from CALC.*.
 */

// ================================================================
// CHART DATASET BUILDER
// ================================================================

function buildDatasets(nbParts, isCadre, includeAids) {
  const points = CALC.generateChartPoints(nbParts, isCadre, includeAids);

  return [
    {
      label: 'Salaire net (cotisations)',
      data: points.map(p => ({ x: p.gross, y: p.net })),
      borderColor: '#d1d5db',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      order: 3,
    },
    {
      label: 'Net après impôt',
      data: points.map(p => ({ x: p.gross, y: p.netAfterIR })),
      borderColor: '#94a3b8',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      order: 2,
    },
    {
      label: includeAids ? 'Revenu total (avec aides)' : 'Revenu total',
      data: points.map(p => ({ x: p.gross, y: p.total })),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.06)',
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.3,
      fill: true,
      order: 1,
    },
  ];
}

// ================================================================
// CROSSHAIR PLUGIN (Chart.js)
// ================================================================

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (chart._crosshairX == null) return;
    const { ctx, chartArea } = chart;
    ctx.save();

    // Dashed vertical line
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(chart._crosshairX, chartArea.top);
    ctx.lineTo(chart._crosshairX, chartArea.bottom);
    ctx.strokeStyle = 'rgba(99,102,241,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dot on the total-revenue line (dataset index 2)
    const ds = chart.data.datasets[2];
    if (ds && chart._crosshairGross != null) {
      const idx  = Math.round(chart._crosshairGross / CALC.STEP);
      const cIdx = Math.max(0, Math.min(ds.data.length - 1, idx));
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
// CHART INIT
// ================================================================

const canvas = document.getElementById('myChart');

const myChart = new Chart(canvas.getContext('2d'), {
  type: 'line',
  data: { datasets: [] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend:  { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: CALC.MAX_GROSS,
        title: {
          display: true,
          text: 'Salaire brut mensuel (€)',
          color: '#9ca3af',
          font: { size: 12 },
        },
        ticks: {
          callback: v => v.toLocaleString('fr-FR') + ' €',
          color: '#9ca3af',
          maxTicksLimit: 10,
        },
        grid:   { color: '#f3f4f6' },
        border: { color: '#e5e7eb' },
      },
      y: {
        title: {
          display: true,
          text: 'Revenu mensuel (€)',
          color: '#9ca3af',
          font: { size: 12 },
        },
        ticks: {
          callback: v => v.toLocaleString('fr-FR') + ' €',
          color: '#9ca3af',
        },
        grid:   { color: '#f3f4f6' },
        border: { color: '#e5e7eb' },
      },
    },
  },
});

// ================================================================
// MOUSE EVENTS → crosshair + details panel
// ================================================================

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x    = e.clientX - rect.left;
  const ca   = myChart.chartArea;
  if (!ca) return;

  if (x >= ca.left && x <= ca.right) {
    const grossRaw = myChart.scales.x.getValueForPixel(x);
    const gross    = Math.max(0, Math.min(CALC.MAX_GROSS, grossRaw));
    myChart._crosshairX     = x;
    myChart._crosshairGross = gross;
    renderDetails(gross);
  } else {
    myChart._crosshairX     = null;
    myChart._crosshairGross = null;
    clearDetails();
  }
  myChart.update('none');
});

canvas.addEventListener('mouseleave', () => {
  myChart._crosshairX     = null;
  myChart._crosshairGross = null;
  myChart.update('none');
  clearDetails();
});

// ================================================================
// DETAILS PANEL — rendering
// ================================================================

// Toggle cotisations breakdown open/closed
document.getElementById('cotToggle').addEventListener('click', () => {
  document.getElementById('cotBlock').classList.toggle('open');
});

// ── Formatting helpers ──────────────────────────────────────────

function fmtEur(v)  { return Math.round(v).toLocaleString('fr-FR') + ' €'; }
function fmtPct(r)  { return (r * 100).toFixed(1) + ' %'; }
function placeholder() { return '<span class="placeholder">—</span>'; }

// ── Read current control values ─────────────────────────────────

function getInputs() {
  return {
    nbParts:     Math.max(0.5, parseFloat(document.getElementById('nbParts').value) || 1),
    isCadre:     document.getElementById('status').value === 'cadre',
    includeAids: document.getElementById('includeAids').checked,
  };
}

// ── Main render ─────────────────────────────────────────────────

function renderDetails(grossRaw) {
  const gross = Math.round(grossRaw / CALC.STEP) * CALC.STEP;
  const { nbParts, isCadre, includeAids } = getInputs();
  const r = CALC.calculate(gross, nbParts, isCadre, includeAids);
  const b = r.breakdown;

  // Scalar fields
  setText('dGross',   fmtEur(gross));
  setText('dCot',     '−' + fmtEur(r.totalCotisations));
  setText('dNet',     fmtEur(r.net));
  setText('dTax',     r.monthlyIR > 0.5 ? '−' + fmtEur(r.monthlyIR) : fmtEur(0));
  setText('dRateEff', fmtPct(r.effectiveRate));
  setText('dRateTMI', fmtPct(r.marginalRate));
  setText('dAids',    r.aide > 0.5 ? '+' + fmtEur(r.aide) : fmtEur(0));
  setText('dTotal',   fmtEur(r.total));

  // Cotisations breakdown list
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
    {
      label: 'APEC (cadres)',
      val:   b.apec,
      sub:   '≤ 4×PMSS · 0,024 %',
    },
    {
      label: 'CSG déductible',
      val:   b.csg_ded,
      sub:   '6,80 % × 98,25 % brut',
    },
    {
      label: 'CSG non-déd. + CRDS',
      val:   b.csg_non_ded + b.crds,
      sub:   '2,40 % + 0,50 % — non déductibles IR',
    },
  ];

  document.getElementById('cotList').innerHTML = lines
    .filter(line => line.val > 0.005)
    .map(line => `
      <div class="cot-row">
        <div>
          <span class="cot-row-label">${line.label}</span>
          ${line.sub ? `<span class="cot-row-sub">${line.sub}</span>` : ''}
        </div>
        <span class="cot-row-val">−${fmtEur(line.val)}</span>
      </div>
    `).join('');

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
  ['dGross','dCot','dNet','dTax','dRateEff','dRateTMI','dAids','dTotal']
    .forEach(id => setHTML(id, ph));
  document.getElementById('cotList').innerHTML   = '';
  document.getElementById('grossBadge').style.display = 'none';
}

// ── DOM helpers ─────────────────────────────────────────────────

function setText(id, text) { document.getElementById(id).textContent = text; }
function setHTML(id, html) { document.getElementById(id).innerHTML   = html; }

// ================================================================
// REBUILD — called when any control changes
// ================================================================

function rebuild() {
  const { nbParts, isCadre, includeAids } = getInputs();

  // Show/hide aids section
  document.getElementById('aidsRow').style.display     = includeAids ? '' : 'none';
  document.getElementById('aidsDivider').style.display = includeAids ? '' : 'none';

  // Update chart
  myChart.data.datasets = buildDatasets(nbParts, isCadre, includeAids);
  myChart.update();

  // Update legend
  document.getElementById('legend').innerHTML = myChart.data.datasets.map(ds => `
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
