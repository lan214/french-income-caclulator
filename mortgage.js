'use strict';

const MORT = (() => {
  function monthlyPayment(loan, annualRatePct, years) {
    const r = annualRatePct / 100 / 12;
    const n = years * 12;
    if (r === 0) return loan / n;
    return loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  }

  // Max loan using 35% debt-ratio rule (HCSF) on monthly net before IR
  function maxLoan(annualNetBeforeIR, annualRatePct, years) {
    const cap = (annualNetBeforeIR / 12) * 0.35;
    const r = annualRatePct / 100 / 12;
    const n = years * 12;
    if (r === 0) return cap * n;
    return cap * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  }

  function loanSummary(loan, annualRatePct, years) {
    const monthly = monthlyPayment(loan, annualRatePct, years);
    const n = years * 12;
    const totalRepaid = monthly * n;
    const totalInterest = totalRepaid - loan;
    return { monthly, totalRepaid, totalInterest, avgMonthlyInterest: totalInterest / n };
  }

  return { monthlyPayment, maxLoan, loanSummary };
})();
