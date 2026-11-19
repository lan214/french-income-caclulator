const assert = require('node:assert/strict');
const test = require('node:test');
const CALC = require('./load-calculator.cjs')();

const single = { adults: 1, isDualIncome: false, childrenAges: [] };
const couple = { adults: 2, isDualIncome: false, childrenAges: [] };
const dual = { ...couple, isDualIncome: true };
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${actual} should equal ${expected}`);

test('deduction cap is applied to each of two €150,000 annual salaries', () => {
  const salaries = [150000 / 12, 150000 / 12];
  closeTo(CALC.calcTaxableIncome(salaries), 270890);
  closeTo(CALC.calcAnnualIR(salaries, dual), 78665.94);
  closeTo(CALC.calcAnnualIR(300000 / 12, couple), 84633.49);
});

test('deduction minimum applies separately and never exceeds an earner salary', () => {
  closeTo(CALC.calcTaxableIncome([40000 / 12, 500 / 12]), 36000);
  closeTo(CALC.calcTaxableIncome([40000 / 12, 1000 / 12]), 36491);
  closeTo(CALC.calcTaxableIncome([0, 0]), 0);
});

test('salary distribution affects capped deductions even at the same combined income', () => {
  closeTo(CALC.calcAnnualIR([150000 / 12, 100000 / 12], dual), 60033.49);
  closeTo(CALC.calcAnnualIR([125000 / 12, 125000 / 12], dual), 59851.04);
});

test('household net and contribution breakdown sum the two actual payrolls', () => {
  for (const cadre of [false, true]) {
    for (const [total, share] of [[6000, 0.5], [15000, 0.8], [20000, 0.25]]) {
      const first = CALC.calculate(total * share, single, cadre, false);
      const second = CALC.calculate(total * (1 - share), single, cadre, false);
      const result = CALC.calculate(total, { ...dual, primaryIncomeShare: share }, cadre, false);
      closeTo(result.net, first.net + second.net);
      closeTo(result.netImposable, first.netImposable + second.netImposable);
      closeTo(result.totalCotisations, first.totalCotisations + second.totalCotisations);
      for (const key of Object.keys(result.breakdown)) {
        closeTo(result.breakdown[key], first.breakdown[key] + second.breakdown[key]);
      }
      closeTo(result.annualIR, CALC.calcAnnualIR([first.netImposable, second.netImposable], dual));
      closeTo(result.total, result.net - result.effectiveMonthlyIR);
    }
  }
});

test('€6,000 split evenly has no second payroll tranche, unlike one €6,000 salary', () => {
  const one = CALC.calculate(6000, couple, true, false);
  const two = CALC.calculate(6000, dual, true, false);
  assert.ok(one.breakdown.agirc_t2 > 0);
  closeTo(two.breakdown.agirc_t2, 0);
  closeTo(two.breakdown.vieillesse_plaf, 6000 * 0.069);
});

test('default split is 50/50; swapping earners preserves household results', () => {
  const defaults = CALC.calculate(10000, dual, true, false);
  const explicit = CALC.calculate(10000, { ...dual, primaryIncomeShare: 0.5 }, true, false);
  closeTo(defaults.annualIR, explicit.annualIR);
  const first = CALC.calculate(10000, { ...dual, primaryIncomeShare: 0.8 }, true, false);
  const second = CALC.calculate(10000, { ...dual, primaryIncomeShare: 0.2 }, true, false);
  closeTo(first.annualIR, second.annualIR);
  closeTo(first.net, second.net);
});

test('0/100% splits match a single-earner couple; single adults ignore the split', () => {
  const one = CALC.calculate(8000, couple, true, false);
  for (const share of [0, 1, -1, 2]) {
    const two = CALC.calculate(8000, { ...dual, primaryIncomeShare: share }, true, false);
    closeTo(two.annualIR, one.annualIR);
    closeTo(two.net, one.net);
  }
  const baseline = CALC.calculate(2000, single, true, false);
  const unchanged = CALC.calculate(2000, { ...single, isDualIncome: true, primaryIncomeShare: 0.1 }, true, false);
  closeTo(unchanged.annualIR, baseline.annualIR);
  closeTo(unchanged.net, baseline.net);
});

test('two-earner tax still applies family cap and then Pinel', () => {
  const family = { ...dual, childrenAges: [5, 8], primaryIncomeShare: 0.7 };
  const first = CALC.calculate(10500, single, true, false);
  const second = CALC.calculate(4500, single, true, false);
  const noChildrenTax = CALC.calcAnnualIR([first.netImposable, second.netImposable], dual);
  const result = CALC.calculate(15000, family, true, false,
    { enabled: true, investment: 200000, duration: 9, type: 'plus' });
  closeTo(result.annualIR, noChildrenTax - 3614);
  closeTo(result.pinelBenefitAnnual, 4000);
  closeTo(result.effectiveMonthlyIR * 12, result.annualIR - 4000);
});

test('generated monthly and annual chart data use the selected salary split', () => {
  const family = { ...dual, primaryIncomeShare: 0.8 };
  const points = CALC.generateChartPoints(family, true, false);
  const point = points.find(item => item.gross === 10000);
  const result = CALC.calculate(10000, family, true, false);
  assert.equal(point.net, Math.round(result.net));
  assert.equal(point.netAfterIR, Math.round(result.net - result.effectiveMonthlyIR));
});
