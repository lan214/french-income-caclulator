const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Minimal DOM/Chart boundary doubles; calculation and UI scripts run unchanged.
function loadUI() {
  const elements = new Map();
  let adults = 1;
  const document = {
    activeElement: null,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        id, value: '', checked: false, hidden: false, style: {}, dataset: {},
        handlers: {}, innerHTML: '', textContent: '',
        replaceChildren() { this.innerHTML = ''; },
        classList: { toggle() {}, add() {}, remove() {} },
        get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); },
        addEventListener(type, callback) { this.handlers[type] = callback; },
        querySelectorAll() { return []; },
        getContext() { return { canvas: this }; },
        focus() { document.activeElement = this; }, select() {},
        blur() { document.activeElement = null; this.handlers.blur?.(); },
      });
      return elements.get(id);
    },
    querySelector(selector) {
      return { dataset: { val: selector.includes('pinel') ? 'plus' : String(adults) } };
    },
    querySelectorAll() { return []; },
  };
  for (const [id, value] of Object.entries({
    nbChildren: '0', status: 'cadre', primaryIncomeShare: '50',
    pinelInvest: '200000', pinelDuration: '9', mortRateSlider: '3.5', mortYearsSlider: '20',
  })) document.getElementById(id).value = value;
  document.getElementById('dualIncome').checked = true;
  class Chart {
    static register() {}
    constructor(context, config) {
      this.canvas = context.canvas;
      this.data = config.data;
      this.options = config.options;
      this.chartArea = { left: 0, right: 1000 };
      this.scales = {
        x: { max: config.options.scales.x.max, getPixelForValue: value => value },
        y: { getPixelForValue: value => value },
      };
    }
    update() {}
  }
  const context = vm.createContext({ document, Chart, navigator: { maxTouchPoints: 0 } });
  for (const file of ['calculator.js', 'mortgage.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return {
    document,
    evaluate: code => vm.runInContext(code, context),
    setAdults(value) { adults = value; },
  };
}

test('salary split control appears only for two-earner couples and normalizes percentages', () => {
  const ui = loadUI();
  const field = ui.document.getElementById('incomeSplitField');
  const input = ui.document.getElementById('primaryIncomeShare');
  assert.equal(field.style.display, 'none');
  ui.setAdults(2);
  ui.evaluate('rebuild()');
  assert.equal(field.style.display, '');
  for (const [value, expected] of [['80', 0.8], ['0', 0], ['100', 1], ['', 0.5], ['200', 1], ['-5', 0]]) {
    input.value = value;
    input.handlers.input();
    assert.equal(ui.evaluate('getInputs().family.primaryIncomeShare'), expected);
  }
  ui.document.getElementById('dualIncome').checked = false;
  ui.document.getElementById('dualIncome').handlers.change();
  assert.equal(field.style.display, 'none');
});

test('changing salary split refreshes a typed frozen amount and both chart datasets', () => {
  const ui = loadUI();
  ui.setAdults(2);
  const annual = ui.document.getElementById('aGross');
  ui.document.getElementById('aGrossDisplay').handlers.click();
  annual.value = '240000';
  annual.handlers.input();
  annual.blur();
  const oldTax = ui.document.getElementById('aTax').textContent;
  const split = ui.document.getElementById('primaryIncomeShare');
  split.value = '80';
  split.handlers.input();
  assert.equal(ui.evaluate('frozenGross'), 20000);
  assert.equal(ui.evaluate('monthlyChart._crosshairX'), 20000);
  assert.equal(ui.evaluate('annualChart._crosshairX'), 240000);
  assert.equal(ui.document.getElementById('dGross').value, '20000');
  assert.equal(ui.document.getElementById('aGross').value, '240000');
  assert.notEqual(ui.document.getElementById('aTax').textContent, oldTax);
  assert.equal(ui.document.getElementById('aTax').textContent, ui.evaluate(
    "'−' + fmtEur(CALC.calculate(20000, getInputs().family, true, false).annualIR)"));
  assert.equal(ui.document.getElementById('aTaxableIncome').textContent, ui.evaluate(
    'fmtEur(CALC.calculate(20000, getInputs().family, true, false).annualTaxableIncome)'));
  assert.equal(ui.document.getElementById('dTaxableIncome').textContent, ui.evaluate(
    'fmtEur(CALC.calculate(20000, getInputs().family, true, false).annualTaxableIncome / 12)'));
  assert.equal(ui.evaluate('annualChart.data.datasets[1].data.find(p => p.x === 240000).y'),
    ui.evaluate('monthlyChart.data.datasets[1].data.find(p => p.x === 20000).y * 12'));
  ui.setAdults(1);
  ui.evaluate('rebuild()');
  assert.equal(ui.document.getElementById('incomeSplitField').style.display, 'none');
});

test('tax base is shown after deductions, handles zero and clears with the selection', () => {
  const ui = loadUI();
  ui.evaluate('renderDetails(3000)');
  assert.equal(ui.document.getElementById('aTaxableIncome').textContent, '26 563 €');
  assert.equal(ui.document.getElementById('dTaxableIncome').textContent, '2 214 €');
  const salaryBeforeDeduction = ui.document.getElementById('aNetImposable').textContent;
  assert.equal(salaryBeforeDeduction, '29 515 €');
  ui.evaluate('renderDetails(0)');
  assert.equal(ui.document.getElementById('aTaxableIncome').textContent, '0 €');
  ui.evaluate('clearDetails()');
  for (const id of ['dTaxableIncome', 'aTaxableIncome']) {
    assert.equal(ui.document.getElementById(id).innerHTML, '<span class="placeholder">—</span>');
  }
});
