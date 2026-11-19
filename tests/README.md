# Calculation regression tests

Run from the repository root with Node.js (no packages required):

```sh
node --test tests/*.test.cjs
```

Tests exercise the browser's `CALC` namespace in an isolated Node VM. Tax examples
use the **2026 assessment of 2025 income**, with the default salary deduction.
Amounts retain cents for chart continuity rather than reproducing every tax-notice
rounding step. The €61 collection threshold and exceptional high-income levies are
outside these checks; this remains a salary-based estimate.

## Décote

Source: [Ministry of Economy: décote, 2026 assessment](https://www.economie.gouv.fr/particuliers/impots-et-fiscalite/gerer-mon-impot-sur-le-revenu/pouvez-vous-beneficier-de-la-decote-de-limpot-sur-le-revenu).
Individual allowance €897; joint allowance €1,483; coefficient 45.25%. Apply after
the tax scale (and family cap when applicable), before Pinel or other reductions.

## Family quotient cap

Source: [Service Public: 2026 income-tax calculation](https://www.service-public.gouv.fr/particuliers/vosdroits/F34328).
The child benefit is capped at €1,807 per additional half-part; a single parent's
first child has a special €4,262 cap for its full part. Cases assume exclusive
custody, attached children, and eligibility for case T for single parents, as in
the existing family controls. Shared custody, disability and other special cases
are not modeled. The reported marginal bracket accounts for a binding cap.

## Two-earner households

Source: [Service Public: salary expense deduction](https://www.service-public.gouv.fr/particuliers/vosdroits/F1989).
The €509 minimum (limited to actual salary) and €14,555 maximum apply separately
to each earner. `calcAnnualIR` and `calcTaxableIncome` accept a monthly net taxable
salary or an array with one amount per earner. `calculate` takes total household
gross and splits it using `family.primaryIncomeShare` (0–1, default 0.5), applying
the existing payroll model to each salary before adding household income.

Couples represent married/PACS joint filers. The UI exposes the gross split for
two earners; one-earner couples and individuals retain the previous gross meaning.
Both earners use the selected employment status. Family benefits retain the
existing simplified formulas; this change does not make those full CAF estimates.
