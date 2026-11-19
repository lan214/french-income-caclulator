const assert = require('node:assert/strict');
const test = require('node:test');
const CALC = require('./load-calculator.cjs')();

const couple = count => ({ adults: 2, isDualIncome: false, childrenAges: Array(count).fill(5) });
const parent = count => ({ adults: 1, isDualIncome: false, childrenAges: Array(count).fill(5) });
const monthlySalary = taxable => taxable / 0.9 / 12;
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${actual} should equal ${expected}`);

test('official €90,000 taxable example: couple with one child owes €11,400.98', () => {
  closeTo(CALC.calcAnnualIR(monthlySalary(90000), couple(1)), 11400.98);
});

test('official €90,000 taxable example: couple with two children owes €9,593.98', () => {
  closeTo(CALC.calcAnnualIR(monthlySalary(90000), couple(2)), 9593.98);
});

test('uncapped official €60,000 example retains tax of €3,410 for one child', () => {
  closeTo(CALC.calcAnnualIR(monthlySalary(60000), couple(1)), 3410);
});

test('third child receives two additional half-part caps', () => {
  // €13,207.98 on two adult parts, less four half-part caps of €1,807.
  closeTo(CALC.calcAnnualIR(monthlySalary(90000), couple(3)), 5979.98);
});

test('single parent gets the special first-child cap, then ordinary child caps', () => {
  // €20,700.52 on one adult part; first-child cap €4,262.
  closeTo(CALC.calcAnnualIR(monthlySalary(90000), parent(1)), 16438.52);
  closeTo(CALC.calcAnnualIR(monthlySalary(90000), parent(2)), 14631.52);
  closeTo(CALC.calcAnnualIR(monthlySalary(90000), parent(3)), 11017.52);
});

test('marginal bracket uses adult parts when the child benefit is capped', () => {
  // At €75,000, three parts suggest 11%, but the binding cap uses two parts: 30%.
  closeTo(CALC.getMarginalRate(monthlySalary(75000), couple(2)), 0.30);
  closeTo(CALC.getMarginalRate(monthlySalary(60000), couple(1)), 0.11);
});

test('family cap is applied before décote and Pinel', () => {
  const result = CALC.calculate(10000, couple(2), true, false,
    { enabled: true, investment: 200000, duration: 9, type: 'plus' });
  closeTo(result.annualIR, 9342.90322);
  closeTo(result.pinelBenefitAnnual, 4000);
  closeTo(result.effectiveMonthlyIR * 12, 5342.90322);
});

test('tax is continuous on either side of the family-cap crossover', () => {
  // One-child crossover: the €1,807 cap starts binding near €65,310.63.
  const crossover = 65310.63157894737;
  const center = CALC.calcAnnualIR(monthlySalary(crossover), couple(1));
  const before = CALC.calcAnnualIR(monthlySalary(crossover - 0.01), couple(1));
  const after = CALC.calcAnnualIR(monthlySalary(crossover + 0.01), couple(1));
  assert.ok(before <= center && center <= after);
  assert.ok(after - before < 0.02);
  closeTo(center - before, 0.0011);
  closeTo(after - center, 0.003);
});
