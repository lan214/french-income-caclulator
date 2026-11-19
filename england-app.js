/** England UI. No French tax assumptions are shared with ENGLAND_CALC. */
(() => {
  const $ = id => document.getElementById(id);
  const money = value => (Math.abs(value) < 0.5 ? 0 : value).toLocaleString('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  });
  const percent = value => (value * 100).toFixed(1) + '%';
  const axisMoney = value => Math.abs(value) >= 10000
    ? '£' + (value / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + 'k' : money(value);
  const number = (id, fallback = 0) => Number.isFinite(parseFloat($(id).value)) ? parseFloat($(id).value) : fallback;
  const bound = (value, low, high) => Math.max(low, Math.min(high, value));
  let frozen = true;
  let selectedGross = 4000;
  let lastGross = 4000;
  let childDrafts = [];

  function readOptions() {
    const adults = number('en-adults', 1);
    const date = /^\d{4}-\d{2}-\d{2}$/.test($('en-date').value)
      && $('en-date').value >= '2026-04-06' && $('en-date').value <= '2027-04-05'
      ? $('en-date').value : ENGLAND_CALC.DEFAULT_DATE;
    return {
      adults, share: bound(number('en-share', 50), 0, 100) / 100,
      support: $('en-support').checked, supportMode: $('en-support-mode').value,
      capital: Math.max(0, number('en-capital')), housing: Math.max(0, number('en-housing')),
      london: $('en-london').checked, claimChildBenefit: $('en-claim-cb').checked,
      capExempt: $('en-cap-exempt').checked, capGrace: $('en-cap-grace').checked,
      married: adults === 2 && $('en-married').checked,
      marriageAllowance: $('en-marriage').checked, date,
      earners: Array.from({ length: adults }, (_, i) => ({
        age: bound(number(`en-age-${i}`, 30), 18, 65),
        pensionPercent: bound(number(`en-pension-${i}`), 0, 100),
        studentPlan: $(`en-loan-${i}`).value, postgraduate: $(`en-pg-${i}`).checked,
        capability: $(`en-capability-${i}`).value, carer: $(`en-carer-${i}`).checked,
      })),
      children: Array.from({ length: bound(Math.floor(number('en-child-count')), 0, 10) }, (_, i) => ({
        born: $(`en-child-born-${i}`).value,
        education: $(`en-child-education-${i}`).checked,
        disability: $(`en-child-disability-${i}`).value,
        childcare: Math.max(0, number(`en-child-care-${i}`)),
      })),
    };
  }

  function renderChildren() {
    const count = bound(Math.floor(number('en-child-count')), 0, 10);
    childDrafts = childDrafts.map((draft, i) => $(`en-child-born-${i}`) ? {
      born: $(`en-child-born-${i}`).value, education: $(`en-child-education-${i}`).checked,
      disability: $(`en-child-disability-${i}`).value, childcare: number(`en-child-care-${i}`),
    } : draft);
    $('en-children').innerHTML = '';
    if (!count) return;
    const card = document.createElement('section');
    card.className = 'england-settings';
    const heading = document.createElement('h2');
    heading.textContent = 'Children & registered childcare';
    heading.style.fontSize = '14px';
    card.appendChild(heading);
    for (let i = 0; i < count; i++) {
      const draft = childDrafts[i] || { born: '2020-01-01', education: false, disability: 'none', childcare: 0 };
      childDrafts[i] = draft;
      const child = document.createElement('div');
      child.className = 'england-child';
      child.innerHTML = `<h3>Child ${i + 1}</h3><div class="england-children-grid">
        <div class="field"><label for="en-child-born-${i}">Date of birth</label><input type="date" id="en-child-born-${i}"></div>
        <div class="field"><label for="en-child-care-${i}">Registered childcare bill (£/month)</label><input type="number" id="en-child-care-${i}" min="0" step="1"></div>
        <div class="field"><label for="en-child-disability-${i}">Qualifying child disability award</label><select id="en-child-disability-${i}"><option value="none">None</option><option value="lower">UC lower disabled-child addition</option><option value="higher">UC higher disabled-child addition</option></select></div>
        <div class="checkbox-row"><input id="en-child-education-${i}" type="checkbox"><label for="en-child-education-${i}">Approved education / training (ages 16–19)</label></div></div>`;
      card.appendChild(child);
      $('en-children').appendChild(card);
      $(`en-child-born-${i}`).value = draft.born;
      $(`en-child-care-${i}`).value = draft.childcare;
      $(`en-child-disability-${i}`).value = draft.disability;
      $(`en-child-education-${i}`).checked = draft.education;
      for (const suffix of ['born', 'care', 'disability', 'education']) {
        $(`en-child-${suffix}-${i}`).addEventListener('input', rebuild);
      }
    }
  }

  const crosshair = {
    id: 'england-crosshair',
    afterDraw(chart) {
      if (chart._selectedX == null || !chart.chartArea) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.setLineDash(frozen ? [] : [4, 4]);
      ctx.strokeStyle = 'rgba(99,102,241,0.6)';
      ctx.lineWidth = frozen ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(chart._selectedX, chartArea.top);
      ctx.lineTo(chart._selectedX, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(chart._selectedX, chart.scales.y.getPixelForValue(chart._selectedY), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
  const charts = ['monthly', 'annual'].map((period, i) => new Chart($(`en-canvas-${period}`).getContext('2d'), {
    type: 'line', data: { datasets: [] }, plugins: [crosshair], options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { type: 'linear', min: 0, max: ENGLAND_CALC.MAX_GROSS * (i ? 12 : 1),
          title: { display: true, text: `Gross household salary (£/${i ? 'year' : 'month'})` },
          ticks: { maxTicksLimit: 5, callback: axisMoney }, grid: { color: '#f3f4f6' } },
        y: { title: { display: true, text: 'Income (£)' },
          ticks: { callback: axisMoney }, grid: { color: '#f3f4f6' } },
      },
    },
  }));

  function rows(items, multiplier = 1) {
    return items.map(([label, value]) => `<div class="cot-row"><span class="cot-row-label">${label}</span><span class="cot-row-val">${money(value * multiplier)}</span></div>`).join('');
  }

  function showGross(gross) {
    for (const [period, factor] of [['monthly', 1], ['annual', 12]]) {
      const input = $(`en-gross-${period}`);
      $(`en-gross-display-${period}`).textContent = gross == null ? '—' : money(gross * factor);
      if (document.activeElement !== input) input.value = gross == null ? '' : Number((gross * factor).toFixed(2));
    }
  }

  function renderDetails(result, options) {
    showGross(result.gross);
    for (const [period, factor] of [['monthly', 1], ['annual', 12]]) {
      const values = {
        pension: -result.pension, ni: -result.nationalInsurance, tax: -result.incomeTaxAnnual / 12,
        loans: -result.loans, 'take-home': result.takeHome, charge: -result.childBenefit.chargeAnnual / 12,
        'child-benefit': result.childBenefit.monthly, uc: result.universalCreditMonthly,
        total: result.total, tfc: result.childcareTopUp, 'after-childcare': result.afterChildcare,
        'tax-base': result.taxableAnnual / 12,
      };
      for (const [key, value] of Object.entries(values)) $(`en-${key}-${period}`).textContent = money(value * factor);
      $(`en-effective-${period}`).textContent = percent(result.effectiveRate);
      $(`en-ni-details-${period}`).innerHTML = rows([
        ['Employee NI at 8%', result.earners.reduce((n, earner) => n + earner.niMain, 0)],
        ['Employee NI at 2%', result.earners.reduce((n, earner) => n + earner.niUpper, 0)],
        ['Employer NI (not deducted)', result.employerNI],
      ], factor);
      $(`en-earner-details-${period}`).innerHTML = result.earners.map((earner, i) => `<h4>Adult ${i + 1}</h4>${rows([
        ['Pay after salary sacrifice', earner.pay], ['Personal Allowance', earner.personalAllowance / 12],
        ['Taxable income', earner.taxable / 12], ['Tax at 20%', earner.basic / 12],
        ['Tax at 40%', earner.higher / 12], ['Tax at 45%', earner.additional / 12],
        ['Marriage tax credit', -(earner.marriageCredit || 0) / 12],
      ], factor)}<p class="field-help">Marginal Income Tax including allowance taper: ${percent(earner.marginalRate)}.</p>`).join('');
      const ucRows = options.support && options.supportMode === 'uc' ? [
        ['UC standard allowance', result.uc.standard], ['Child elements', result.uc.childElement],
        ['Disabled-child additions', result.uc.disabledChildren], ['LCWRA element', result.uc.lcwra],
        ['Carer elements', result.uc.carers], ['Eligible housing amount', result.uc.housing],
        ['Eligible childcare reimbursement', result.uc.childcare], ['Earnings taper deduction', -result.uc.earningsReduction],
        ['Savings tariff deduction', -result.uc.capitalReduction], ['Benefit-cap deduction', -result.uc.capReduction],
      ] : [];
      $(`en-uc-details-${period}`).innerHTML = rows([
        ['Child Benefit before tax charge', result.childBenefit.monthly], ...ucRows,
        ['UC award', result.universalCreditMonthly],
      ], factor) + (options.support && options.supportMode === 'uc'
        ? `<p class="field-help">Monthly UC work allowance: ${money(result.uc.workAllowance)}. ${result.uc.capExempt ? 'Benefit cap does not apply.' : 'Benefit cap checked.'}</p>` : '');
      const multiple = bound(number('en-multiple', 4.5), 0, 8);
      const loan = result.gross * 12 * multiple;
      const rate = bound(number('en-mort-rate', 4.5), 0, 15);
      const years = bound(number('en-mort-years', 25), 1, 40);
      const repayment = MORT.monthlyPayment(loan, rate, years);
      $(`en-mortgage-${period}`).innerHTML = rows([
        ['Indicative loan (one-off amount)', loan],
      ]) + rows([['Repayment', repayment], ['Cash remaining after repayment', result.total - repayment]], factor);
      const messages = [];
      if (options.support && options.supportMode === 'uc' && result.uc.capitalDisqualified) messages.push('UC is zero: counted capital exceeds £16,000.');
      if (options.marriageAllowance) messages.push(result.marriageApplied ? 'Marriage Allowance transfer applied.' : 'Marriage Allowance transfer not eligible.');
      if (options.support && options.supportMode === 'tfc') messages.push('Tax-Free Childcare goes to a childcare account; it is not cash income. Working-income and child-age tests apply.');
      if (result.children.length !== options.children.length) messages.push('Some children are outside the entered age / education eligibility.');
      if (result.earners.some(earner => earner.pension * 12 > 60000)) messages.push('Pension contributions exceed £60,000: pension allowance charges are not modeled.');
      $(`en-message-${period}`).textContent = messages.join(' ');
    }
  }

  function selectGross(gross, exact = false) {
    const bounded = bound(gross, 0, ENGLAND_CALC.MAX_GROSS);
    selectedGross = exact ? bounded : Math.floor(bounded / 10) * 10;
    lastGross = selectedGross;
    const options = readOptions();
    const result = ENGLAND_CALC.calculate(selectedGross, options);
    renderDetails(result, options);
    charts.forEach((chart, i) => {
      const factor = i ? 12 : 1;
      chart._selectedX = chart.scales.x.getPixelForValue(selectedGross * factor);
      chart._selectedY = result.total * factor;
      chart.update('none');
      $(`en-hint-${i ? 'annual' : 'monthly'}`).textContent = frozen
        ? 'Frozen · Click the chart to unfreeze' : 'Move over the chart · Slow down for £10 precision · Click to freeze';
    });
  }

  function clearSelection() {
    selectedGross = null;
    showGross(null);
    for (const period of ['monthly', 'annual']) {
      for (const key of ['pension', 'ni', 'tax', 'loans', 'take-home', 'charge', 'child-benefit', 'uc', 'total', 'tfc', 'after-childcare', 'tax-base', 'effective']) {
        $(`en-${key}-${period}`).textContent = '—';
      }
      for (const key of ['ni-details', 'earner-details', 'uc-details', 'mortgage']) $(`en-${key}-${period}`).innerHTML = '';
      $(`en-message-${period}`).textContent = '';
    }
    charts.forEach(chart => { chart._selectedX = null; chart.update('none'); });
  }

  charts.forEach((chart, i) => {
    const factor = i ? 12 : 1;
    let mouse = null;
    let touch = null;
    const localX = clientX => clientX - chart.canvas.getBoundingClientRect().left;
    const pointed = x => chart.scales.x.getValueForPixel(x) / factor;
    const inside = x => chart.chartArea && x >= chart.chartArea.left && x <= chart.chartArea.right;
    chart.canvas.addEventListener('mousemove', event => {
      if (frozen || touch) return;
      const x = localX(event.clientX);
      if (!inside(x)) { mouse = null; clearSelection(); return; }
      if (!mouse) mouse = { x, time: event.timeStamp, income: pointed(x), armed: true, anchor: null };
      const dx = x - mouse.x;
      const speed = Math.abs(dx) / Math.max(1, event.timeStamp - mouse.time);
      if (mouse.anchor == null && mouse.armed && dx !== 0 && speed <= 0.25) mouse.anchor = mouse.x;
      if (mouse.anchor != null && Math.abs(x - mouse.anchor) > 30) { mouse.anchor = null; mouse.armed = false; }
      mouse.income = mouse.anchor == null ? pointed(x) : bound(mouse.income + dx * 10, 0, ENGLAND_CALC.MAX_GROSS);
      if (mouse.anchor == null && speed > 0.25) mouse.armed = true;
      mouse.x = x; mouse.time = event.timeStamp;
      selectGross(mouse.income);
    });
    chart.canvas.addEventListener('mouseleave', () => { mouse = null; if (!frozen) clearSelection(); });
    chart.canvas.addEventListener('click', event => {
      if (!inside(localX(event.clientX))) return;
      frozen = !frozen;
      mouse = null;
      selectGross(selectedGross == null ? pointed(localX(event.clientX)) : selectedGross, true);
    });
    chart.canvas.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      const x = localX(event.touches[0].clientX);
      if (!inside(x)) return;
      event.preventDefault();
      touch = { id: event.touches[0].identifier, x, start: x, time: event.timeStamp,
        income: frozen && selectedGross != null ? selectedGross : pointed(x), wasFrozen: frozen, moved: false };
      frozen = false;
      selectGross(touch.income);
    }, { passive: false });
    chart.canvas.addEventListener('touchmove', event => {
      if (!touch) return;
      const finger = Array.from(event.touches).find(item => item.identifier === touch.id);
      if (!finger) return;
      event.preventDefault();
      const x = localX(finger.clientX);
      if (!touch.moved && Math.abs(x - touch.start) < 1) return;
      touch.moved = true;
      const dx = x - touch.x;
      const speed = Math.abs(dx) / Math.max(1, event.timeStamp - touch.time);
      const t = bound((speed - 0.35) / 1.45, 0, 1);
      touch.income = bound(touch.income + dx * (10 + 2.5 * t * t * (3 - 2 * t)), 0, ENGLAND_CALC.MAX_GROSS);
      touch.x = x; touch.time = event.timeStamp;
      selectGross(touch.income);
    }, { passive: false });
    chart.canvas.addEventListener('touchend', event => {
      if (!touch || !Array.from(event.changedTouches).some(finger => finger.identifier === touch.id)) return;
      event.preventDefault();
      frozen = !(touch.wasFrozen && !touch.moved);
      touch = null;
      selectGross(lastGross, true);
    }, { passive: false });
    chart.canvas.addEventListener('touchcancel', () => {
      if (!touch) return;
      touch = null; frozen = true; selectGross(lastGross, true);
    });
  });

  for (const [period, factor] of [['monthly', 1], ['annual', 12]]) {
    const input = $(`en-gross-${period}`);
    const display = $(`en-gross-display-${period}`);
    display.addEventListener('click', () => {
      frozen = true;
      if (selectedGross != null) selectGross(selectedGross, true);
      display.hidden = true; input.hidden = false; input.focus(); input.select();
    });
    input.addEventListener('input', () => {
      if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
      frozen = true;
      selectGross(input.valueAsNumber / factor, true);
    });
    input.addEventListener('blur', () => {
      showGross(selectedGross);
      input.hidden = true; display.hidden = false;
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
  }

  function rebuild() {
    const options = readOptions();
    $('en-adult-1').hidden = options.adults !== 2;
    $('en-share-field').hidden = options.adults !== 2;
    $('en-marriage-fields').hidden = options.adults !== 2;
    const points = ENGLAND_CALC.generateChartPoints(options);
    const series = [
      ['After pension & employee NI', 'afterNI', '#c99e71'],
      ['After tax, NI, pension & loans', 'afterTax', '#52ab5b'],
      ['Total with cash support', 'total', '#6366f1'],
    ];
    charts.forEach((chart, i) => {
      const factor = i ? 12 : 1;
      chart.data.datasets = series.map(([label, key, color]) => ({
        label, data: points.map(point => ({ x: point.gross * factor, y: point[key] * factor })),
        borderColor: color, borderWidth: key === 'total' ? 2.5 : 1.5, pointRadius: 0,
        tension: 0, fill: key === 'total', backgroundColor: 'rgba(99,102,241,0.06)',
      }));
      chart.update('none');
    });
    $('en-legend').innerHTML = series.map(([label, , color]) => `<div class="legend-item"><span class="legend-line" style="background:${color}"></span>${label}</div>`).join('');
    if (selectedGross != null) selectGross(selectedGross, true);
  }

  $('en-child-count').addEventListener('input', () => { renderChildren(); rebuild(); });
  for (const input of document.querySelectorAll('#en-controls input, #en-controls select, .england-settings input, .england-settings select')) {
    if (input.id !== 'en-child-count') input.addEventListener('input', rebuild);
  }
  renderChildren();
  rebuild();
})();
