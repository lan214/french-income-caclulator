const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const C = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'england-calculator.js'), 'utf8') + '\nENGLAND_CALC;');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6,
  `${actual} should equal ${expected}`);
const child = (born = '2020-01-01', extra = {}) => ({ born, ...extra });

test('England 2026/27 Income Tax applies progressive bands and individual allowances', () => {
  for (const [annual, tax, allowance] of [
    [0, 0, 12570], [12570, 0, 12570], [30000, 3486, 12570],
    [50270, 7540, 12570], [60000, 11432, 12570], [100000, 27432, 12570],
    [110000, 33432, 7570], [125140, 42516, 0], [150000, 53703, 0],
  ]) {
    const result = C.incomeTax(annual);
    close(result.annualTax, tax);
    close(result.personalAllowance, allowance);
  }
  close(C.incomeTax(110000).marginalRate, 0.60);
  close(C.incomeTax(150000).marginalRate, 0.45);
});

test('monthly NI uses £1,048 and £4,189 thresholds, not annual thresholds / 12', () => {
  close(C.payroll(1048).nationalInsurance, 0);
  close(C.payroll(1049).nationalInsurance, 0.08);
  close(C.payroll(4189).nationalInsurance, 251.28);
  close(C.payroll(4190).nationalInsurance, 251.30);
  close(C.payroll(5000).nationalInsurance, 267.50);
});

test('employer NI is separate from employee net and accounts for under-21 relief', () => {
  close(C.payroll(2000, { age: 30 }).employerNI, 237.45);
  close(C.payroll(2000, { age: 20 }).employerNI, 0);
  const result = C.calculate(2500, { support: false });
  close(result.total * 12, 25120.08);
});

test('salary-sacrifice pension reduces cash pay, NI, taxable income and ANI', () => {
  const result = C.calculate(10000, { support: false, earners: [{ pensionPercent: 10 }] });
  close(result.pension, 1000);
  close(result.earners[0].adjustedNetIncome, 108000);
  close(result.personalAllowanceAnnual, 8570);
  close(result.earners[0].annualTax, C.incomeTax(108000).annualTax);
  close(result.total, 9000 - result.nationalInsurance - result.incomeTaxAnnual / 12);
});

test('couples have independent taxes and NI; splitting household pay matters', () => {
  const one = C.calculate(5000, { support: false });
  const two = C.calculate(5000, { support: false, adults: 2, share: 0.5 });
  close(one.incomeTaxAnnual, 11432);
  close(two.incomeTaxAnnual, 6972);
  close(two.nationalInsurance, 232.32);
  const asymmetric = C.calculate(5000, { support: false, adults: 2, share: 0.8 });
  const swapped = C.calculate(5000, { support: false, adults: 2, share: 0.2 });
  close(asymmetric.total, swapped.total);
});

test('Marriage Allowance matches GOV.UK £11,500 + £20,000 example, saving £214', () => {
  const options = { adults: 2, share: 11500 / 31500, support: false, married: true };
  const ordinary = C.calculate(31500 / 12, options);
  const transferred = C.calculate(31500 / 12, { ...options, marriageAllowance: true });
  close(ordinary.incomeTaxAnnual - transferred.incomeTaxAnnual, 214);
  close(transferred.earners[0].annualTax, 38);
  assert.equal(transferred.marriageApplied, true);
  assert.equal(C.calculate(31500 / 12, { ...options, marriageAllowance: true, married: false }).marriageApplied, false);
  assert.equal(C.calculate(70000 / 12, { ...options, share: 0, marriageAllowance: true }).marriageApplied, false);
});

test('student plans use payroll thresholds and whole-pound deductions; PG can coexist', () => {
  for (const [plan, expected] of [['1', 68], ['2', 49], ['4', 16], ['5', 82], ['none', 0]]) {
    close(C.payroll(3000, { studentPlan: plan }).studentLoan, expected);
  }
  const result = C.calculate(3000, { support: false, earners: [{ studentPlan: '2', postgraduate: true }] });
  close(result.loans, 124);
  close(result.total, result.afterNI - result.incomeTaxAnnual / 12 - 124);
});

test('child eligibility checks age, education, dates and first-child priority', () => {
  close(C.childAge('2020-11-20', '2026-11-19'), 5);
  const children = C.qualifyingChildren([
    child('2020-01-01'), child('2010-01-01'), child('2009-01-01', { education: true }),
    child('2006-01-01', { education: true }), child('2027-01-01'), child('2020-02-31'),
  ]);
  assert.equal(children.length, 2);
  assert.equal(children[0].born, '2009-01-01');
});

test('Child Benefit is £27.05 / £17.90 weekly with 52-week annualisation', () => {
  const result = C.calculate(0, { supportMode: 'none', children: [child(), child()] });
  close(result.childBenefit.annual, 2337.40);
  close(result.total, 2337.40 / 12);
});

test('HICBC uses highest individual ANI, in 1% steps per £200, capped at 100%', () => {
  for (const [salary, chargePercent] of [[60000, 0], [60199, 0], [60200, 1], [70000, 50], [80000, 100], [100000, 100]]) {
    const result = C.calculate(salary / 12, { supportMode: 'none', children: [child()] });
    close(result.childBenefit.chargePercent, chargePercent);
    close(result.childBenefit.chargeAnnual, Math.round(1406.60 * chargePercent) / 100);
  }
  const couple = C.calculate(100000 / 12, { adults: 2, children: [child()], supportMode: 'none' });
  close(couple.childBenefit.chargeAnnual, 0);
  const noClaim = C.calculate(100000 / 12, { children: [child()], claimChildBenefit: false });
  close(noClaim.childBenefit.annual, 0);
  close(noClaim.childBenefit.chargeAnnual, 0);
});

test('UC standard allowances distinguish age and joint claims', () => {
  close(C.calculate(0).universalCreditMonthly, 424.90);
  close(C.calculate(0, { earners: [{ age: 24 }] }).universalCreditMonthly, 338.58);
  close(C.calculate(0, { adults: 2 }).universalCreditMonthly, 666.97);
  close(C.calculate(0, { adults: 2, earners: [{ age: 24 }, { age: 24 }] }).universalCreditMonthly, 528.34);
});

test('UC includes all children after April 2026, with higher pre-2017 first-child amount', () => {
  const result = C.calculate(0, { children: [child('2022-01-01'), child('2016-01-01'), child('2020-01-01')] });
  close(result.uc.childElement, 351.88 + 303.94 * 2);
  close(result.uc.workAllowance, 710);
});

test('UC earnings taper is 55%, with a household work allowance only when eligible', () => {
  const noChildren = C.calculate(1000);
  close(noChildren.uc.workAllowance, 0);
  close(noChildren.uc.earningsReduction, 550);
  close(noChildren.universalCreditMonthly, 0);
  const parent = C.calculate(1000, { children: [child()] });
  close(parent.uc.earningsReduction, 159.50);
  close(parent.universalCreditMonthly, 569.34);
  const housing = C.calculate(1000, { children: [child()], housing: 500 });
  close(housing.uc.workAllowance, 427);
  close(housing.uc.earningsReduction, 315.15);
});

test('student-loan repayments reduce cash but not UC assessable earnings', () => {
  const options = { children: [child()], housing: 1000 };
  const ordinary = C.calculate(2500, options);
  const borrower = C.calculate(2500, { ...options, earners: [{ studentPlan: '5', postgraduate: true }] });
  close(ordinary.uc.earnings, borrower.uc.earnings);
  close(ordinary.universalCreditMonthly, borrower.universalCreditMonthly);
  assert.ok(borrower.takeHome < ordinary.takeHome);
});

test('UC capital tariffs include part £250 and eligibility ends above £16,000', () => {
  for (const [capital, reduction] of [[6000, 0], [6000.01, 4.35], [6250, 4.35], [6300, 8.70], [16000, 174]]) {
    const result = C.calculate(0, { capital });
    close(result.uc.capitalReduction, reduction);
    close(result.universalCreditMonthly, 424.90 - reduction);
  }
  close(C.calculate(0, { capital: 16000.01 }).universalCreditMonthly, 0);
});

test('benefit cap counts UC and Child Benefit, uses location, and respects exemptions', () => {
  const options = { children: [child('2016-01-01'), child(), child('2022-01-01')], housing: 800 };
  const rest = C.calculate(0, options);
  close(rest.total, 1835);
  close(C.calculate(0, { ...options, london: true }).total, 2110.25);
  close(C.calculate(0, { ...options, capGrace: true }).uc.capReduction, 0);
  assert.equal(C.calculate(881, options).uc.capExempt, true);
  assert.equal(C.calculate(880, options).uc.capExempt, false);
});

test('UC childcare is 85%, capped, subject to employment and excluded from benefit cap', () => {
  const options = { housing: 2500, children: [child('2020-01-01', { childcare: 2000 })] };
  close(C.calculate(500, options).uc.childcare, 1071.09);
  const result = C.calculate(500, options);
  close(result.universalCreditMonthly + result.childBenefit.monthly - result.uc.childcare, 1835);
  close(C.calculate(0, options).uc.childcare, 0);
  const couple = { ...options, adults: 2, share: 1 };
  close(C.calculate(500, couple).uc.childcare, 0);
  close(C.calculate(500, { ...couple, earners: [{}, { carer: true }] }).uc.childcare, 1071.09);
  const two = C.calculate(1000, { children: [child('2020-01-01', { childcare: 2000 }), child('2022-01-01', { childcare: 2000 })] });
  close(two.uc.childcare, 1836.16);
});

test('UC confirmed health and carer elements do not double count the same adult', () => {
  close(C.calculate(0, { earners: [{ capability: 'new', carer: true }] }).uc.maximum, 424.90 + 217.26);
  const joint = C.calculate(0, { adults: 2, earners: [{ capability: 'protected' }, { carer: true }] });
  close(joint.uc.maximum, 666.97 + 429.80 + 209.34);
  assert.equal(joint.uc.capExempt, true);
  const both = C.calculate(0, { adults: 2, earners: [
    { capability: 'protected', carer: true }, { capability: 'protected', carer: true },
  ] });
  close(both.uc.maximum, 666.97 + 429.80 + 209.34);
  const disabled = C.calculate(0, { children: [child('2020-01-01', { disability: 'higher' })] });
  close(disabled.uc.disabledChildren, 514.71);
  assert.equal(disabled.uc.capExempt, true);
});

test('Tax-Free Childcare is mutually exclusive with UC, capped per child, and not cash income', () => {
  const options = { supportMode: 'tfc', children: [child('2020-01-01', { childcare: 1000 })] };
  const result = C.calculate(3000, options);
  close(result.universalCreditMonthly, 0);
  close(result.childcareTopUp, 2000 / 12);
  close(result.total, result.afterTax + result.childBenefit.monthly);
  close(result.afterChildcare, result.total - 1000 + 2000 / 12);
  close(C.calculate(3000, { ...options, children: [child('2020-01-01', { childcare: 1000, disability: 'higher' })] }).childcareTopUp, 200);
  close(C.calculate(500, options).childcareTopUp, 0);
  close(C.calculate(100001 / 12, options).childcareTopUp, 0);
});

test('childcare support respects the September age cutoffs', () => {
  const options = { supportMode: 'tfc', children: [child('2015-05-01', { childcare: 500 })] };
  close(C.calculate(3000, { ...options, date: '2026-08-31' }).childcareTopUp, 100);
  close(C.calculate(3000, { ...options, date: '2026-09-01' }).childcareTopUp, 0);
  const older = { children: [child('2010-05-01', { education: true, childcare: 500 })] };
  close(C.calculate(1000, { ...older, date: '2026-08-31' }).uc.childcare, 425);
  close(C.calculate(1000, { ...older, date: '2026-09-01' }).uc.childcare, 0);
});

test('support toggle removes benefit cash, Child Benefit recovery and restricted childcare top-ups', () => {
  const result = C.calculate(70000 / 12, { support: false, supportMode: 'tfc', children: [child('2020-01-01', { childcare: 1000 })] });
  close(result.childBenefit.annual, 0);
  close(result.childBenefit.chargeAnnual, 0);
  close(result.universalCreditMonthly, 0);
  close(result.childcareTopUp, 0);
  close(result.total, result.takeHome);
});

test('chart endpoints and series agree with the detailed engine, without French assumptions', () => {
  const options = { adults: 2, children: [child()], share: 0.75 };
  const points = C.generateChartPoints(options);
  assert.equal(points.length, 501);
  assert.equal(points[0].gross, 0);
  assert.equal(points.at(-1).gross, 25000);
  for (const point of [points[0], points[80], points.at(-1)]) {
    const result = C.calculate(point.gross, options);
    close(point.total, result.total);
    close(point.afterTax, result.afterTax);
    assert.ok(Number.isFinite(point.total));
  }
});
