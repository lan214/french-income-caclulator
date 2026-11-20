const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Boundary doubles only: load the real England HTML, model, mortgage and UI.
function loadUI() {
  const nodes = new Map();
  const charts = [];
  const document = { activeElement: null,
    getElementById: id => nodes.get(id) || null,
    createElement: () => new Element(),
    querySelectorAll: () => [...nodes.values()].filter(node => node.control
      && !node.id.startsWith('en-gross-') && !node.id.startsWith('en-child-')),
  };
  class Element {
    constructor(id = '') {
      this.id = id; this.style = {}; this.handlers = {}; this.checked = false;
      this.hidden = false; this.textContent = ''; this._value = ''; this.control = false;
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    set value(value) { this._value = String(value); }
    get value() { return this._value; }
    get valueAsNumber() { return this._value === '' ? NaN : Number(this._value); }
    set innerHTML(value) { this._html = value; register(value); }
    get innerHTML() { return this._html || ''; }
    appendChild() {}
    replaceChildren() { this._html = ''; }
    addEventListener(event, fn) { (this.handlers[event] ||= []).push(fn); }
    dispatch(event, data = {}) { for (const handler of this.handlers[event] || []) handler(data); }
    focus() { document.activeElement = this; }
    select() {}
    blur() { document.activeElement = null; this.dispatch('blur'); }
    getContext() { return { canvas: this }; }
    getBoundingClientRect() { return { left: 0, width: 1000 }; }
  }
  function register(html) {
    for (const match of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
      const [, tag, attributes, id] = match;
      if (nodes.has(id)) continue;
      const node = new Element(id);
      node.control = ['input', 'select'].includes(tag);
      node.value = attributes.match(/\bvalue="([^"]*)"/)?.[1] || '';
      node.checked = /\bchecked\b/.test(attributes);
      node.hidden = /\bhidden\b/.test(attributes);
      nodes.set(id, node);
    }
    for (const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
      nodes.get(match[1]).value = match[2].match(/<option\b[^>]*value="([^"]+)"/)?.[1] || '';
    }
  }
  register(fs.readFileSync(path.join(__dirname, '..', 'england.html'), 'utf8'));
  class Chart {
    constructor(context, config) {
      this.canvas = context.canvas; this.data = config.data;
      this.chartArea = { left: 50, right: 950 };
      const max = config.options.scales.x.max;
      this.scales = { x: { getPixelForValue: value => 50 + value / max * 900,
        getValueForPixel: x => (x - 50) / 900 * max }, y: { getPixelForValue: value => value } };
      charts.push(this);
    }
    update() {}
  }
  const context = vm.createContext({ document, Chart });
  for (const file of ['england-calculator.js', 'mortgage.js', 'england-app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return { nodes, charts, set(id, value) { nodes.get(id).value = value; nodes.get(id).dispatch('input'); } };
}

test('England page initializes in pounds, with matching annual/monthly chart units', () => {
  const { nodes, charts } = loadUI();
  assert.equal(nodes.get('en-gross-display-monthly').textContent, '£4,000');
  assert.equal(nodes.get('en-gross-display-annual').textContent, '£48,000');
  assert.equal(nodes.get('en-adult-1').hidden, true);
  assert.equal(nodes.get('en-pension-monthly').textContent, '£0');
  assert.equal(charts[0].data.datasets[0].data.length, 501);
  assert.equal(charts[1].data.datasets[2].data[80].x, 48000);
  assert.equal(charts[1].data.datasets[2].data[80].y, charts[0].data.datasets[2].data[80].y * 12);
});

test('click-to-edit annual income preserves exact input and updates couples independently', () => {
  const ui = loadUI();
  ui.nodes.get('en-gross-display-annual').dispatch('click');
  assert.equal(ui.nodes.get('en-gross-annual').hidden, false);
  ui.set('en-gross-annual', '30000');
  ui.nodes.get('en-gross-annual').dispatch('keydown', { key: 'Enter' });
  assert.equal(ui.nodes.get('en-gross-monthly').value, '2500');
  assert.equal(ui.nodes.get('en-tax-annual').textContent, '-£3,486');
  ui.set('en-adults', '2');
  assert.equal(ui.nodes.get('en-adult-1').hidden, false);
  assert.equal(ui.nodes.get('en-tax-annual').textContent, '-£972');
  ui.set('en-share', '100');
  assert.equal(ui.nodes.get('en-tax-annual').textContent, '-£3,486');
  assert.equal(ui.nodes.get('en-gross-annual').value, '30000');
});

test('income editors stay open for IME confirmation and close on ordinary Enter', () => {
  const { nodes } = loadUI();
  for (const period of ['monthly', 'annual']) {
    const input = nodes.get(`en-gross-${period}`);
    nodes.get(`en-gross-display-${period}`).dispatch('click');
    for (const event of [
      { key: 'Enter', isComposing: true },
      { key: 'Enter', isComposing: false, keyCode: 229 },
      { key: 'ArrowRight' },
    ]) {
      input.dispatch('keydown', event);
      assert.equal(input.hidden, false);
    }
    input.dispatch('keydown', { key: 'Enter', isComposing: false, keyCode: 13 });
    assert.equal(input.hidden, true);
  }
});

test('children, scheme changes and support toggle recalculate restricted and cash support', () => {
  const ui = loadUI();
  ui.nodes.get('en-gross-display-annual').dispatch('click');
  ui.set('en-gross-annual', '30000');
  ui.nodes.get('en-gross-annual').blur();
  ui.set('en-child-count', '1');
  ui.set('en-child-care-0', '1000');
  assert.notEqual(ui.nodes.get('en-uc-monthly').textContent, '£0');
  ui.set('en-support-mode', 'tfc');
  assert.equal(ui.nodes.get('en-uc-monthly').textContent, '£0');
  assert.equal(ui.nodes.get('en-tfc-monthly').textContent, '£167');
  ui.nodes.get('en-support').checked = false;
  ui.nodes.get('en-support').dispatch('input');
  assert.equal(ui.nodes.get('en-child-benefit-monthly').textContent, '£0');
  assert.equal(ui.nodes.get('en-tfc-monthly').textContent, '£0');
});

test('pension units preserve contribution, fixed amounts follow monthly/annual displays and salary limits', () => {
  const ui = loadUI();
  ui.set('en-pension-0', '10');
  assert.equal(ui.nodes.get('en-pension-monthly').textContent, '-£400');
  const tax = ui.nodes.get('en-tax-annual').textContent;
  ui.set('en-pension-unit-0', 'monthly');
  assert.equal(ui.nodes.get('en-pension-0').value, '400');
  assert.equal(ui.nodes.get('en-tax-annual').textContent, tax);
  ui.set('en-pension-unit-0', 'annual');
  assert.equal(ui.nodes.get('en-pension-0').value, '4800');
  ui.set('en-pension-0', '6000');
  assert.equal(ui.nodes.get('en-pension-monthly').textContent, '-£500');
  assert.equal(ui.nodes.get('en-pension-annual').textContent, '-£6,000');
  ui.set('en-gross-monthly', '6000');
  assert.equal(ui.nodes.get('en-pension-monthly').textContent, '-£500');
  ui.set('en-pension-unit-0', 'percent');
  assert.equal(ui.nodes.get('en-pension-0').value, '8.333333');
  ui.set('en-pension-unit-0', 'monthly');
  ui.set('en-pension-0', '500');
  ui.set('en-adults', '2');
  ui.set('en-pension-unit-1', 'annual');
  ui.set('en-pension-1', '1200');
  assert.equal(ui.nodes.get('en-pension-monthly').textContent, '-£600');
  ui.set('en-share', '0');
  assert.equal(ui.nodes.get('en-pension-monthly').textContent, '-£100');
});

test('slow mouse adjustment is £10 per pixel, click freezes, leaving clears unfrozen details', () => {
  const { nodes, charts } = loadUI();
  const canvas = charts[0].canvas;
  canvas.dispatch('click', { clientX: 194 });
  canvas.dispatch('mousemove', { clientX: 194, timeStamp: 100 });
  canvas.dispatch('mousemove', { clientX: 195, timeStamp: 200 });
  assert.equal(nodes.get('en-gross-monthly').value, '4010');
  assert.equal(nodes.get('en-gross-annual').value, '48120');
  canvas.dispatch('click', { clientX: 195 });
  canvas.dispatch('mousemove', { clientX: 400, timeStamp: 250 });
  assert.equal(nodes.get('en-gross-monthly').value, '4010');
  canvas.dispatch('click', { clientX: 195 });
  canvas.dispatch('mouseleave');
  assert.equal(nodes.get('en-gross-display-monthly').textContent, '—');
  assert.equal(nodes.get('en-tax-annual').textContent, '—');
});

test('touch movements keep monthly/annual selections aligned and freeze on release', () => {
  const { nodes, charts } = loadUI();
  const canvas = charts[0].canvas;
  const finger = x => ({ identifier: 1, clientX: x });
  canvas.dispatch('touchstart', { touches: [finger(194)], timeStamp: 0, preventDefault() {} });
  canvas.dispatch('touchmove', { touches: [finger(195)], timeStamp: 200, preventDefault() {} });
  canvas.dispatch('touchend', { changedTouches: [finger(195)], preventDefault() {} });
  assert.equal(nodes.get('en-gross-monthly').value, '4010');
  assert.equal(nodes.get('en-gross-annual').value, '48120');
  assert.equal(nodes.get('en-hint-monthly').textContent, 'Frozen · Click the chart to unfreeze');
});
