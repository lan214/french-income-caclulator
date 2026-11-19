/**
 * England employment-income model, 6 April 2026 – 5 April 2027.
 * Pure calculations. GOV.UK sources, eligibility assumptions and worked examples:
 * docs/england-tax-2026-27.md. Cash and restricted childcare support stay separate.
 */
const ENGLAND_CALC = (() => {
  const MAX_GROSS = 25000;
  const STEP = 50;
  const TAX_YEAR = '2026/27';
  const DEFAULT_DATE = '2026-11-19';
  const RATES = Object.freeze({
    personalAllowance: 12570, taperStart: 100000, basicBand: 37700,
    additionalThreshold: 125140, marriageTransfer: 1260,
    niPrimaryMonthly: 1048, niUpperMonthly: 4189, employerThreshold: 417,
    childBenefitFirstWeekly: 27.05, childBenefitOtherWeekly: 17.90,
    ucSingleYoung: 338.58, ucSingle: 424.90, ucCoupleYoung: 528.34, ucCouple: 666.97,
    ucChild: 303.94, ucOlderFirstChild: 351.88,
    ucDisabledChildLower: 164.79, ucDisabledChildHigher: 514.71,
    ucLcwraNew: 217.26, ucLcwraProtected: 429.80, ucCarer: 209.34,
    ucWorkAllowanceHousing: 427, ucWorkAllowanceNoHousing: 710,
    ucChildcareOne: 1071.09, ucChildcareMultiple: 1836.16,
    ucTaper: 0.55, capitalLower: 6000, capitalUpper: 16000, capitalTariff: 4.35,
    capEarningsExemption: 881,
    capLondonFamily: 2110.25, capLondonSingle: 1413.92,
    capOtherFamily: 1835, capOtherSingle: 1229.42,
  });
  const LOAN_MONTHLY_THRESHOLDS = Object.freeze({
    '1': 2241.66, '2': 2448.75, '4': 2816.25, '5': 2083.33,
  });
  const positive = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const pence = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);

  function incomeTax(annualIncome, allowanceAdjustment = 0) {
    const adjustedNetIncome = positive(annualIncome);
    const personalAllowance = Math.max(0, RATES.personalAllowance
      - Math.max(0, adjustedNetIncome - RATES.taperStart) / 2 + allowanceAdjustment);
    const taxable = Math.max(0, adjustedNetIncome - personalAllowance);
    const basic = Math.min(taxable, RATES.basicBand) * 0.20;
    const higher = Math.max(0, Math.min(taxable, RATES.additionalThreshold) - RATES.basicBand) * 0.40;
    const additional = Math.max(0, taxable - RATES.additionalThreshold) * 0.45;
    const marginalRate = adjustedNetIncome > 125140 ? 0.45
      : adjustedNetIncome > 100000 ? 0.60
      : taxable > 37700 ? 0.40 : taxable > 0 ? 0.20 : 0;
    return { adjustedNetIncome, personalAllowance, taxable, basic, higher, additional,
      annualTax: basic + higher + additional, marginalRate };
  }

  function payroll(monthlyGross, settings = {}) {
    const gross = positive(monthlyGross);
    const pension = gross * clamp(positive(settings.pensionPercent), 0, 100) / 100;
    const pay = gross - pension;
    const tax = incomeTax(pay * 12);
    const niMain = pence(Math.max(0, Math.min(pay, RATES.niUpperMonthly) - RATES.niPrimaryMonthly) * 0.08);
    const niUpper = pence(Math.max(0, pay - RATES.niUpperMonthly) * 0.02);
    const nationalInsurance = pence(niMain + niUpper);
    // Employer contribution is contextual; it is never deducted from take-home.
    const employerThreshold = positive(settings.age || 30) < 21 ? RATES.niUpperMonthly : RATES.employerThreshold;
    const employerNI = pence(Math.max(0, pay - employerThreshold) * 0.15);
    const threshold = LOAN_MONTHLY_THRESHOLDS[settings.studentPlan];
    const studentLoan = threshold ? Math.floor(Math.max(0, pay - threshold) * 0.09 + 1e-9) : 0;
    const postgraduateLoan = settings.postgraduate
      ? Math.floor(Math.max(0, pay - 1750) * 0.06 + 1e-9) : 0;
    return { gross, pension, pay, ...tax, niMain, niUpper, nationalInsurance,
      employerNI, studentLoan, postgraduateLoan };
  }

  function applyMarriageAllowance(earners, options) {
    if (earners.length !== 2 || !options.married || !options.marriageAllowance) return false;
    const donor = earners[0].adjustedNetIncome <= earners[1].adjustedNetIncome ? 0 : 1;
    const recipient = 1 - donor;
    if (earners[donor].adjustedNetIncome > 12570
      || earners[recipient].adjustedNetIncome <= 12570
      || earners[recipient].adjustedNetIncome > 50270) return false;
    Object.assign(earners[donor], incomeTax(earners[donor].adjustedNetIncome, -1260));
    const taxCredit = Math.min(252, earners[recipient].annualTax);
    earners[recipient].annualTax -= taxCredit;
    earners[recipient].marriageCredit = taxCredit;
    return true;
  }

  function childAge(born, date = DEFAULT_DATE) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(born || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return -1;
    const birth = new Date(born + 'T00:00:00Z');
    const asOf = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(birth.getTime()) || birth > asOf || birth.toISOString().slice(0, 10) !== born) return -1;
    let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
    if (date.slice(5) < born.slice(5)) age--;
    return age;
  }

  function qualifyingChildren(children = [], date = DEFAULT_DATE) {
    return children.filter(child => {
      const age = childAge(child.born, date);
      return age >= 0 && (age < 16 || (age < 20 && child.education));
    }).sort((a, b) => a.born.localeCompare(b.born));
  }

  function childBenefit(children, earners, claim = true) {
    const annual = !claim || !children.length ? 0
      : (27.05 + (children.length - 1) * 17.90) * 52;
    const highestIncome = Math.max(0, ...earners.map(earner => earner.adjustedNetIncome));
    const chargePercent = clamp(Math.floor((highestIncome - 60000) / 200), 0, 100);
    const chargeAnnual = pence(annual * chargePercent / 100);
    return { annual, monthly: annual / 12, chargeAnnual, chargePercent };
  }

  function careException(settings) {
    return settings.carer || settings.capability === 'new' || settings.capability === 'protected';
  }

  function beforeSeptemberAfterBirthday(child, birthday, date) {
    const year = Number(child.born.slice(0, 4)) + birthday + (child.born.slice(5) >= '09-01' ? 1 : 0);
    return date < `${year}-09-01`;
  }

  function universalCredit(earners, adults, children, options, childBenefitMonthly) {
    const standard = adults.length === 2
      ? (adults.every(adult => adult.age < 25) ? RATES.ucCoupleYoung : RATES.ucCouple)
      : (adults[0].age < 25 ? RATES.ucSingleYoung : RATES.ucSingle);
    const childElement = children.length * RATES.ucChild
      + (children.length && children[0].born < '2017-04-06' ? RATES.ucOlderFirstChild - RATES.ucChild : 0);
    const disabledChildren = children.reduce((total, child) => total
      + (child.disability === 'higher' ? RATES.ucDisabledChildHigher
        : child.disability === 'lower' ? RATES.ucDisabledChildLower : 0), 0);
    // A joint award has one LCWRA element. Allocate it to preserve the greatest
    // entitlement when another eligible adult can receive a carer element.
    const capabilityAmounts = adults.map(adult => adult.capability === 'protected'
      ? RATES.ucLcwraProtected : adult.capability === 'new' ? RATES.ucLcwraNew : 0);
    const carersExcept = index => adults.reduce((total, adult, i) => total
      + (adult.carer && i !== index ? RATES.ucCarer : 0), 0);
    let lcwraIndex = -1;
    capabilityAmounts.forEach((amount, i) => {
      if (amount > 0 && (lcwraIndex < 0 || amount + carersExcept(i)
        > capabilityAmounts[lcwraIndex] + carersExcept(lcwraIndex))) lcwraIndex = i;
    });
    const lcwra = lcwraIndex < 0 ? 0 : capabilityAmounts[lcwraIndex];
    const carers = carersExcept(lcwraIndex);
    const housing = positive(options.housing);
    const costs = children.filter(child => beforeSeptemberAfterBirthday(child, 16, options.date))
      .map(child => positive(child.childcare));
    const careCount = costs.filter(cost => cost > 0).length;
    const childcareWorkEligible = earners.some(earner => earner.pay > 0)
      && earners.every((earner, i) => earner.pay > 0 || careException(adults[i]));
    const childcare = childcareWorkEligible ? Math.min(costs.reduce((a, b) => a + b, 0) * 0.85,
      careCount > 1 ? RATES.ucChildcareMultiple : careCount === 1 ? RATES.ucChildcareOne : 0) : 0;
    const maximum = standard + childElement + disabledChildren + lcwra + carers + housing + childcare;
    const workAllowance = children.length || adults.some(adult => adult.capability !== 'none')
      ? (housing > 0 ? RATES.ucWorkAllowanceHousing : RATES.ucWorkAllowanceNoHousing) : 0;
    // Student-loan repayments and HICBC are NOT deductible from UC earned income.
    const earnings = earners.reduce((total, earner) => total
      + Math.max(0, earner.pay - earner.nationalInsurance - earner.annualTax / 12), 0);
    const earningsReduction = Math.max(0, earnings - workAllowance) * RATES.ucTaper;
    const capital = positive(options.capital);
    const capitalReduction = Math.ceil(Math.max(0, capital - 6000) / 250) * 4.35;
    const capitalDisqualified = capital > 16000;
    const beforeCap = capitalDisqualified ? 0 : Math.max(0, maximum - earningsReduction - capitalReduction);
    const familyCap = adults.length === 2 || children.length > 0;
    const cap = options.london ? (familyCap ? RATES.capLondonFamily : RATES.capLondonSingle)
      : (familyCap ? RATES.capOtherFamily : RATES.capOtherSingle);
    const exempt = earnings >= RATES.capEarningsExemption || lcwra > 0 || carers > 0
      || disabledChildren > 0 || Boolean(options.capExempt) || Boolean(options.capGrace);
    // Reimbursed eligible childcare is excluded from the benefit cap.
    const capReduction = exempt ? 0 : Math.min(beforeCap,
      Math.max(0, beforeCap - childcare + childBenefitMonthly - cap));
    return { standard, childElement, disabledChildren, lcwra, carers, housing, childcare,
      maximum, workAllowance, earnings, earningsReduction, capitalReduction,
      capitalDisqualified, cap, capExempt: exempt, capReduction, monthly: beforeCap - capReduction };
  }

  function taxFreeChildcare(earners, adults, children, options) {
    const workEligible = earners.every((earner, i) => earner.pay * 12
      >= (adults[i].age >= 21 ? 12.71 : 10.85) * 16 * 52);
    if (!workEligible || earners.some(earner => earner.adjustedNetIncome > 100000)) return 0;
    return children.reduce((total, child) => {
      const disabled = child.disability === 'lower' || child.disability === 'higher';
      if (!beforeSeptemberAfterBirthday(child, disabled ? 16 : 11, options.date)) return total;
      return total + Math.min(positive(child.childcare) * 0.20, (disabled ? 4000 : 2000) / 12);
    }, 0);
  }

  function calculate(grossMonthly, input = {}) {
    const options = { date: DEFAULT_DATE, support: true, supportMode: 'uc',
      claimChildBenefit: true, ...input };
    const totalGross = clamp(positive(grossMonthly), 0, MAX_GROSS);
    const count = Number(options.adults) === 2 ? 2 : 1;
    const adultSettings = Array.from({ length: count }, (_, i) => ({
      age: 30, pensionPercent: 0, studentPlan: 'none', postgraduate: false,
      capability: 'none', carer: false, ...options.earners?.[i],
    }));
    const share = count === 1 ? 1 : clamp(Number.isFinite(Number(options.share)) ? Number(options.share) : 0.5, 0, 1);
    const earners = adultSettings.map((adult, i) => payroll(totalGross * (i === 0 ? share : 1 - share), adult));
    const marriageApplied = applyMarriageAllowance(earners, options);
    const children = qualifyingChildren(options.children, options.date);
    const cb = childBenefit(children, earners, options.support && options.claimChildBenefit);
    const uc = universalCredit(earners, adultSettings, children, options, cb.monthly);
    const universalCreditMonthly = options.support && options.supportMode === 'uc' ? uc.monthly : 0;
    const childcareTopUp = options.support && options.supportMode === 'tfc'
      ? taxFreeChildcare(earners, adultSettings, children, options) : 0;
    const pension = sum(earners, 'pension');
    const nationalInsurance = sum(earners, 'nationalInsurance');
    const incomeTaxAnnual = sum(earners, 'annualTax');
    const loans = sum(earners, 'studentLoan') + sum(earners, 'postgraduateLoan');
    const afterNI = totalGross - pension - nationalInsurance;
    const takeHome = afterNI - incomeTaxAnnual / 12 - loans;
    const afterTax = takeHome - cb.chargeAnnual / 12;
    const cashSupport = cb.monthly + universalCreditMonthly;
    const total = afterTax + cashSupport;
    const childcareBill = (options.children || []).reduce((amount, child) => amount + positive(child.childcare), 0);
    return { gross: totalGross, earners, children, marriageApplied, pension, nationalInsurance,
      employerNI: sum(earners, 'employerNI'), incomeTaxAnnual, loans,
      personalAllowanceAnnual: sum(earners, 'personalAllowance'), taxableAnnual: sum(earners, 'taxable'),
      afterNI, takeHome, afterTax, childBenefit: cb, uc, universalCreditMonthly,
      cashSupport, childcareTopUp, childcareBill, total,
      afterChildcare: total - childcareBill + childcareTopUp,
      effectiveRate: totalGross > 0 ? (incomeTaxAnnual + cb.chargeAnnual) / (totalGross * 12) : 0,
    };
  }

  function generateChartPoints(options) {
    const points = [];
    for (let gross = 0; gross <= MAX_GROSS; gross += STEP) {
      const result = calculate(gross, options);
      points.push({ gross, afterNI: result.afterNI, afterTax: result.afterTax, total: result.total });
    }
    return points;
  }

  return { MAX_GROSS, STEP, TAX_YEAR, RATES, DEFAULT_DATE, incomeTax, payroll,
    childAge, qualifyingChildren, childBenefit, universalCredit, taxFreeChildcare,
    calculate, generateChartPoints };
})();
