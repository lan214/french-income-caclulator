const assert = require('node:assert/strict');
const test = require('node:test');
const CALC = require('./load-calculator.cjs')();

const single = { adults: 1, isDualIncome: false, childrenAges: [] };
const couple = { adults: 2, isDualIncome: false, childrenAges: [] };
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${actual} should equal ${expected}`);

test('single taxpayer: €20,000 declared salary yields €125.56 after décote', () => {
  // €18,000 after 10% deduction; €704 gross tax; €578.44 décote.
  closeTo(CALC.calcAnnualIR(20000 / 12, single), 125.56);
});

test('official single-taxpayer example: €1,400 gross tax yields €1,136.50', () => {
  const salary = (11600 + 1400 / 0.11) / 0.9;
  closeTo(CALC.calcAnnualIR(salary / 12, single), 1136.50);
});

test('official couple example: €2,800 gross tax yields €2,584', () => {
  const salary = (11600 * 2 + 2800 / 0.11) / 0.9;
  closeTo(CALC.calcAnnualIR(salary / 12, couple), 2584);
});

test('single parent uses the individual décote even with two tax parts', () => {
  const parent = { ...single, childrenAges: [5] };
  // €30,000 taxable, two parts: €748 gross, €558.53 décote.
  closeTo(CALC.calcAnnualIR((30000 / 0.9) / 12, parent), 189.47);
});

test('décote cannot create negative tax and stops at its formula boundary', () => {
  closeTo(CALC.calcAnnualIR(0, single), 0);
  closeTo(CALC.calcAnnualIR(15000 / 12, single), 0);
  for (const [family, allowance] of [[single, 897], [couple, 1483]]) {
    const boundary = allowance / 0.4525;
    for (const grossTax of [boundary - 0.01, boundary, boundary + 0.01]) {
      const firstBandTax = 1977.69 * family.adults;
      const taxable = grossTax <= firstBandTax
        ? family.adults * 11600 + grossTax / 0.11
        : family.adults * 29579 + (grossTax - firstBandTax) / 0.30;
      const expected = grossTax - Math.max(0, allowance - grossTax * 0.4525);
      closeTo(CALC.calcAnnualIR(taxable / 0.9 / 12, family), expected);
    }
  }
});

test('tax above the décote range retains the progressive bracket result', () => {
  closeTo(CALC.calcAnnualIR(40000 / 12, single), 3903.99);
});

test('monthly details, net income and Pinel use tax after décote', () => {
  const plain = CALC.calculate(2000, single, true, false);
  closeTo(plain.annualIR, 79.027129);
  closeTo(plain.monthlyIR * 12, plain.annualIR);
  closeTo(plain.total, plain.net - plain.monthlyIR);
  const pinel = CALC.calculate(2000, single, true, false,
    { enabled: true, investment: 10000, duration: 9, type: 'plus' });
  closeTo(pinel.pinelBenefitAnnual, plain.annualIR);
  closeTo(pinel.effectiveMonthlyIR, 0);
  closeTo(pinel.total, pinel.net);
});
