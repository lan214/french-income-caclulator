# England income, tax and support model — 2026/27

Research checked **19 November 2026**. Tax year: **6 April 2026 to 5 April 2027**.
Currency: pounds sterling. The England tab uses `ENGLAND_CALC` in
`england-calculator.js`; the French `CALC` engine remains separate.

## Scope and interpretation

This is a steady-state household employment-income estimate for England residents
aged 18–65 with one monthly-paid job per adult. Salary entered on either chart is
the **combined household gross**; the split determines each adult's salary.
Tax and NI are individual; UC eligibility and means-testing are household-based.
Cohabiting couples can claim joint UC, without marriage or joint Income Tax.

An annual chart annualises the same monthly circumstances. It does not predict
changes in earnings, birthdays, assessment periods, benefit decisions or residence
over the next twelve months. The assessment date is used for child eligibility;
rates stay fixed to 2026/27. Benefits assume qualifying residence, public-funds
access, no student restriction, correct reporting and completed claims.

There is no French salary deduction, family quotient, CSG, or HCSF borrowing rule
in this model. Scotland's different Income Tax bands are not implemented.

## 1. Income Tax and adjusted net income

For each person, start with annual salary **after salary sacrifice**. In this
salary-only model this is adjusted net income (ANI). Savings, dividends, rental
income, taxable benefits, Gift Aid and other deductible pension arrangements need
additional inputs and are not assumed to be zero in a real tax assessment.

Personal Allowance (PA):

```text
PA = max(0, £12,570 − max(0, ANI − £100,000) / 2)
taxable salary = max(0, ANI − PA)
```

Apply 20% to the first £37,700 of taxable salary, 40% to the next £87,440, and 45%
to the remainder. The allowance is exhausted at £125,140 ANI. Its withdrawal
creates a 60% marginal Income Tax rate between £100,000 and £125,140. This is not
an additional statutory band. NI and benefit withdrawal can further affect a pay
increase. The effective rate shown is Income Tax plus HICBC divided by gross,
excluding NI, loan repayments and pension saving.

The app spreads the calculated annual liability over 12 months, not a cumulative
PAYE tax-code simulation. Bonuses, emergency codes, earlier employment and final
Self Assessment rounding can differ.

Sources: [current Income Tax rules](https://www.gov.uk/income-tax-rates),
[allowance taper](https://www.gov.uk/income-tax-rates/income-over-100000).

### Marriage Allowance

An optional election for married/civil partners transfers £1,260 from the lower
earner's PA and gives the eligible basic-rate recipient up to £252 tax relief.
It is not a joint tax return. Eligibility is tested before the election, with
donor salary at most £12,570 and recipient salary above £12,570 and at most
£50,270. The donor can acquire a small tax bill; that is included.

Example from [GOV.UK Marriage Allowance](https://www.gov.uk/marriage-allowance):
£11,500 and £20,000 salaries save the couple £214, rather than the full £252,
because the donor owes £38 after transferring the allowance. The model covers
ordinary salary-only elections, not older Married Couple's Allowance cases.

## 2. National Insurance, pensions and loans

Employee Class 1 NI uses **monthly** thresholds: 8% on pay above £1,048 up to
£4,189, then 2% above £4,189. Bands are rounded to pence. Monthly thresholds are
not annual thresholds divided by twelve: £12,570/12 is £1,047.50. Directors,
multiple jobs, deferment, special category letters and pension-age exemptions
are outside scope.

Employer NI is displayed for context: 15% above £417/month, or above £4,189 for
ordinary under-21 relief. It never reduces take-home. Employer-level Employment
Allowance and specialised reliefs are not allocated to an employee.

Pension input is specifically **salary sacrifice**, entered per adult as a percentage
of contractual gross, pounds per month, or pounds per year (divided by 12).
Switching units preserves the contribution at the selected salary. A fixed pound
amount stays fixed while exploring the graph; a percentage scales with salary.
The modeled deduction is limited to each adult's gross pay, including at lower
chart salaries. It reduces cash salary, taxable salary, NI pay and ANI. Ordinary net-pay
or relief-at-source pensions, employer pension contributions, carry-forward,
annual-allowance charges and tapered pension allowances are not calculated.
Employers must keep sacrifice within minimum-wage rules; hours are not entered.

Student loans use one selected undergraduate plan per person, plus an optional
postgraduate loan. Deduct 9% above the monthly threshold, rounding down to whole
pounds. Thresholds: Plan 1 £2,241.66; Plan 2 £2,448.75; Plan 4 £2,816.25; Plan 5
£2,083.33. Postgraduate repayments are 6% above £1,750/month, also rounded down.
Payments use pay after salary sacrifice. Outstanding balances, interest, loan
write-off dates and multiple concurrent undergraduate plans are not modeled.

Sources: [HMRC 2026/27 payroll thresholds, rates and loan recovery](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027),
[employee NI explanation](https://www.gov.uk/national-insurance/how-much-you-pay),
[salary sacrifice](https://www.gov.uk/guidance/salary-sacrifice-and-the-effects-on-paye).

## 3. Child Benefit and its high-income charge

Eligible children are under 16, or under 20 with approved education/training
confirmed. Birthday/education flags approximate boundary eligibility; actual
school-leaving and continuation deadlines must be checked. The model assumes
eligible children live with the claimant and no competing claim exists.

The weekly amount is £27.05 for the eldest qualifying child and £17.90 for every
other child. Multiply by 52 for annual income, then divide by 12 for the displayed
monthly average; actual four-week payment dates are different.

HICBC depends on the **highest individual's ANI**, not combined household income.
Repay 1% of claimed Child Benefit for every complete £200 above £60,000; full
recovery at £80,000. The estimate retains pence rather than reproducing all tax
return rounding. It is shown as a separate tax charge, not deducted twice from
the benefit. Opting out of payments removes the charge; NI credits from registering
for Child Benefit are not valued as spendable income.

Sources: [2026/27 Child Benefit rates](https://www.gov.uk/government/publications/rates-and-allowances-tax-credits-child-benefit-and-guardians-allowance/tax-credits-child-benefit-and-guardians-allowance),
[eligibility](https://www.gov.uk/child-benefit/eligibility),
[HICBC](https://www.gov.uk/child-benefit-tax-charge).

## 4. Universal Credit

UC is modeled as a single household monthly award, with these components:

| Component | 2026/27 monthly amount |
| --- | ---: |
| Single under 25 / 25+ | £338.58 / £424.90 |
| Couple both under 25 / either 25+ | £528.34 / £666.97 |
| Each qualifying child | £303.94 |
| Eldest child born before 6 April 2017 | £351.88 instead |
| Disabled-child addition, lower / higher | £164.79 / £514.71 |
| LCWRA new / protected higher rate | £217.26 / £429.80 |
| Eligible carer | £209.34 |

Use only DWP-confirmed disability, work-capability and carer categories. A joint
award has one LCWRA element. A different eligible adult can receive a carer element;
the same adult does not receive both. Two carer elements assume different cared-for
people. An LCW-only selection enables a work allowance but does not add the legacy
pre-April-2017 LCW cash element. PIP/DLA cash awards and Carer's Allowance payments
are not added; their interaction with UC would require further inputs.

The two-child limit ended for assessment periods starting on or after **6 April
2026**. All qualifying children are included. Legacy transitional protections,
pre-2026 assessment periods and managed-migration arrangements are not modeled.

Sources: [DWP 2026/27 uprating table](https://www.gov.uk/government/publications/benefit-and-pension-rates-2026-to-2027/proposed-benefit-and-pension-rates-2026-to-2027),
[UC award components](https://www.gov.uk/universal-credit/what-youll-get),
[two-child-limit removal legislation](https://www.legislation.gov.uk/ukpga/2026/13/body/enacted).

### Earnings and capital

UC earned income is salary after Income Tax, employee NI and salary-sacrifice
pension. Student-loan repayments and the separately estimated HICBC do not reduce
that earned-income figure. With a child or a qualifying limited-capability decision,
one household work allowance is applied: £427/month with a housing element, £710
without. Otherwise it is zero. Reduce the maximum UC award by 55% of earnings
above that allowance.

Counted capital up to £6,000 is disregarded. From there to £16,000, deduct £4.35
per month for every £250 **or part of £250**. Above £16,000, modeled UC is zero.
Enter capital after any applicable statutory disregards. Other countable income,
deductions for debts, advance recovery, sanctions and surplus-earnings rules are
excluded. Do not enter a current maintenance student loan as an earnings repayment;
full-time students require separate eligibility/income treatment.

Sources: [UC wages](https://www.gov.uk/universal-credit/how-your-wages-affect-your-payments),
[DWP earnings guidance](https://www.gov.uk/guidance/universal-credit-and-earnings),
[capital rules](https://www.gov.uk/guidance/universal-credit-money-savings-and-investments).

### Housing, childcare and benefit cap

Housing input is the **eligible UC housing element**, not unrestricted actual rent.
The user must account for Local Housing Allowance, bedroom restrictions, tenure,
non-dependants and service-charge eligibility before entering it. Homeowner
Support for Mortgage Interest is a loan and is not treated as a housing grant.

UC childcare adds 85% of the entered registered childcare bill, capped at £1,071.09
for one child or £1,836.16 for two or more. Ordinarily each adult must work; the
model also accepts an eligible non-working carer/LCWRA partner when the other works.
Age eligibility ends at the September boundary after the child's 16th birthday.
Enter remaining charges **after funded childcare hours**, with no other childcare
grant or vouchers. Reporting timing, upfront grants and exceptional leave cases
require an actual assessment.

The benefit cap includes UC and Child Benefit but excludes eligible UC childcare.
Outside Greater London, limits are £1,835/month for couples or households with
children, £1,229.42 for single adults without children; London equivalents are
£2,110.25 and £1,413.92. A cap reduction can reduce UC to zero, not Child Benefit.
Net household earned income of at least £881/month exempts the household. Confirmed
qualifying disability/carer awards or the separately selected nine-month grace
period can also exempt it. The app does not infer past earnings for the grace period.

Sources: [UC childcare](https://www.gov.uk/help-with-childcare-costs/universal-credit),
[cap and exemptions](https://www.gov.uk/benefit-cap),
[UC cap earnings/grace rules](https://www.gov.uk/benefit-cap/when-benefit-cap-affects-universal-credit-payments),
[DWP childcare/cap guidance](https://data.parliament.uk/DepositedPapers/Files/DEP2025-0364/031._Childcare_costs-Guidance_V31.0.pdf).

## 5. Tax-Free Childcare and other help

UC and Tax-Free Childcare (TFC) are alternative selected schemes, never added
together. TFC contributes 20% of a qualifying childcare bill (the government adds
£2 for each £8 the parent deposits), limited to £2,000 per child annually or £4,000
for a qualifying disabled child. Monthly figures smooth the quarterly £500/£1,000
limits; actual timing and unused quarterly allowance differ.

Each worker must ordinarily earn at least the equivalent of 16 hours/week at
their applicable minimum wage: £12.71/hour aged 21+, £10.85 aged 18–20. Each adult's
ANI must be no more than £100,000. Age eligibility ends in September after the
child turns 11, or 16 for a qualifying disabled child. Non-working-partner
exceptions, leave and self-employed start-up concessions are not implemented.

TFC is restricted childcare-account support: it is **excluded from total cash
income**. The “after entered childcare bill” figure adds this top-up back when
deducting the gross childcare bill. UC childcare, by contrast, is already inside
the UC cash award and is not added a second time.

Sources: [TFC payments](https://www.gov.uk/tax-free-childcare),
[TFC eligibility](https://www.gov.uk/tax-free-childcare/check-if-youre-eligible).

Funded childcare hours, local Council Tax Reduction, PIP/DLA cash awards, new-style
JSA/ESA, Healthy Start, free school meals, local grants and pension-age benefits
are not assigned speculative cash values. Use the linked official eligibility
routes: [funded hours](https://www.gov.uk/apply-free-childcare-if-youre-working),
[Council Tax Reduction](https://www.gov.uk/apply-council-tax-reduction),
[benefits calculators](https://www.gov.uk/benefits-calculators).

## Display arithmetic and worked checks

```text
take-home = gross − salary sacrifice − employee NI − Income Tax − loan repayments
total cash = take-home − HICBC + Child Benefit + UC
after childcare = total cash − registered childcare bill + restricted TFC top-up
```

Housing costs and mortgage repayments are not subtracted from “total cash”. The
mortgage illustration uses a configurable annual-gross multiple and amortisation,
not a UK lending rule or a French debt-ratio limit. No benefits enter its loan base.

| Example (one adult, no pension/loans/support unless specified) | Result |
| --- | --- |
| £30,000 annual gross | Income Tax £3,486; monthly-based NI £1,393.92/year; take-home £25,120.08/year |
| £110,000 annual gross | PA £7,570; Income Tax £33,432 |
| £60,000 household gross split equally | Combined Income Tax £6,972, versus £11,432 for one earner |
| Single age 25+, no earnings/capital | UC £424.90/month |
| One child, £1,000 monthly earnings, no housing | UC £569.34/month plus Child Benefit |
| £6,300 counted capital | UC capital reduction £8.70/month |

## Verification and maintenance

Run `node --test tests/*.test.cjs` and syntax-check both England scripts. Regression
cases include bands, taper, monthly NI, independent earners, Marriage Allowance,
loans, HICBC steps, UC capital and earnings boundaries, cap exemptions, childcare
limits and scheme exclusivity. Existing French checks must continue to pass.
For a new tax year, research rates and legislation afresh; do not merely relabel
the year. Proposed 2027/28 rates are deliberately not used here.
