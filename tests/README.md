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
