/**
 * calculator.js — French salary business logic (2026)
 *
 * Sources:
 *   - URSSAF / legisocial.fr — taux cotisations 2026
 *   - AGIRC-ARRCO — paramètres 2026
 *   - service-public.fr — barème IR 2026 (revenus 2025)
 *   - info.gouv.fr — SMIC 1er janvier 2026
 *   - caf.fr — aides familiales avril 2026
 *
 * No DOM. No Chart.js. Pure functions only.
 * Exposed via the global `CALC` namespace.
 */

const CALC = (() => {

  // ── Chart range ─────────────────────────────────────────────
  const MAX_GROSS = 15000;
  const STEP      = 50;

  // ── Plafond de la Sécurité Sociale 2026 ─────────────────────
  const PMSS = 4005;

  // ── SMIC janvier 2026 ────────────────────────────────────────
  const SMIC_GROSS = 1823.03;
  const SMIC_NET   = 1443.11;

  // ── Barème IR 2026 (revenus 2025, loi de finances 2026) ─────
  const IR_TRANCHES = [
    { min: 0,       max: 11600,    rate: 0    },
    { min: 11600,   max: 29579,    rate: 0.11 },
    { min: 29579,   max: 84577,    rate: 0.30 },
    { min: 84577,   max: 181917,   rate: 0.41 },
    { min: 181917,  max: Infinity, rate: 0.45 },
  ];

  const FP_RATE = 0.10;
  const FP_MIN  = 509;
  const FP_MAX  = 14555;

  // ── Aides individuelles — barème avril 2026 ──────────────────
  const RSA_MAX  = 651.69;  // RSA personne seule
  const MF_PA    = 638.28;  // Montant forfaitaire prime d'activité
  const BONUS_PA = 135;     // Bonification individuelle estimée au SMIC

  // ── Aides familiales — barème 2026 ───────────────────────────

  // Allocations Familiales (enfants < 20 ans ; ≥ 2 enfants)
  const AF_2ENF         = 153.01;   // 2 enfants, taux plein (/mois)
  const AF_3ENF         = 349.06;   // 3 enfants, taux plein (/mois)
  const AF_SUPP         = 196.04;   // par enfant supplémentaire (4ème+)
  const AF_PLAF_T1_BASE = 78565;    // plafond taux plein, 2 enfants (/an)
  const AF_PLAF_T2_BASE = 104719;   // plafond demi-taux, 2 enfants (/an)
  const AF_PLAF_STEP    = 6182;     // majoration plafond par enfant > 2
  // Majoration pour âge — depuis la réforme du 1er mars 2026 :
  // seuil relevé à 18 ans (était 14 ans pour les naissances avant mars 2012)
  const AF_MAJ_AGE      = 75.53;    // /mois/enfant ≥ 18 ans, taux plein

  // PAJE Allocation de base (enfants < 3 ans)
  const PAJE_PLEIN          = 198.16;   // taux plein (/mois, par enfant)
  const PAJE_PARTIEL        =  99.08;   // taux partiel (/mois, par enfant)
  const PAJE_PLAF_PLEIN_MONO = 31066;   // couple monoactif, 1 enfant (/an)
  const PAJE_PLAF_PLEIN_BI   = 41055;   // biactif ou parent seul (/an)
  const PAJE_PLAF_PART_MONO  = 37118;
  const PAJE_PLAF_PART_BI    = 49054;
  const PAJE_PLAF_STEP       = 7700;    // majoration par enfant supplémentaire

  // Allocation Rentrée Scolaire (montants annuels)
  const ARS_6_10      = 426.87;
  const ARS_11_14     = 450.41;
  const ARS_15_18     = 466.02;
  const ARS_PLAF_BASE = 22274;    // 1 enfant (/an)
  const ARS_PLAF_STEP =  6682;    // par enfant supplémentaire

  // Complément Familial (≥ 3 enfants tous âgés 3-21 ans)
  const CF_BASE           = 198.16;
  const CF_MAJORE         = 297.27;
  const CF_PLAF_MAJ_MONO  = 22372;    // couple monoactif, 3 enfants (/an)
  const CF_PLAF_MAJ_BI    = 27367;    // biactif ou parent seul (/an)
  const CF_PLAF_BASE_MONO = 44735;
  const CF_PLAF_BASE_BI   = 54724;
  const CF_PLAF_STEP      = 7456;     // par enfant > 3

  // ================================================================
  // COTISATIONS SALARIALES
  // ================================================================

  function calcCotisations(grossMonthly, isCadre) {
    const T1      = Math.min(grossMonthly, PMSS);
    const T2      = Math.max(0, Math.min(grossMonthly, 8 * PMSS) - PMSS);
    const T1T2    = T1 + T2;
    const csgBase = grossMonthly * 0.9825;

    const vieillesse_plaf = T1           * 0.0690;
    const vieillesse_dep  = grossMonthly * 0.0040;
    const agirc_t1        = T1           * 0.0315;
    const agirc_t2        = T2           * 0.0864;
    const ceg_t1          = T1           * 0.0086;
    const ceg_t2          = T2           * 0.0108;
    const cet             = grossMonthly > PMSS ? T1T2 * 0.0014 : 0;
    const apec            = isCadre ? Math.min(grossMonthly, 4 * PMSS) * 0.00024 : 0;
    const csg_ded         = csgBase      * 0.0680;
    const csg_non_ded     = csgBase      * 0.0240;
    const crds            = csgBase      * 0.0050;

    const totalCotisations = vieillesse_plaf + vieillesse_dep
                           + agirc_t1 + agirc_t2
                           + ceg_t1 + ceg_t2 + cet + apec
                           + csg_ded + csg_non_ded + crds;

    const net          = grossMonthly - totalCotisations;
    const netImposable = net + csg_non_ded + crds;

    return {
      breakdown: {
        vieillesse_plaf, vieillesse_dep,
        agirc_t1, agirc_t2,
        ceg_t1, ceg_t2, cet,
        apec,
        csg_ded, csg_non_ded, crds,
      },
      totalCotisations,
      net,
      netImposable,
    };
  }

  // ================================================================
  // IMPÔT SUR LE REVENU
  // ================================================================

  function calcAnnualIR(netImposableMonthly, nbParts) {
    const annual     = netImposableMonthly * 12;
    const abattement = Math.min(FP_MAX, Math.max(FP_MIN, annual * FP_RATE));
    const taxable    = annual - abattement;
    const perPart    = taxable / nbParts;

    let taxPerPart = 0;
    for (const t of IR_TRANCHES) {
      if (perPart > t.min) {
        taxPerPart += (Math.min(perPart, t.max) - t.min) * t.rate;
      }
    }
    return Math.max(0, taxPerPart * nbParts);
  }

  function getMarginalRate(netImposableMonthly, nbParts) {
    const annual     = netImposableMonthly * 12;
    const abattement = Math.min(FP_MAX, Math.max(FP_MIN, annual * FP_RATE));
    const perPart    = (annual - abattement) / nbParts;
    for (let i = IR_TRANCHES.length - 1; i >= 0; i--) {
      if (perPart > IR_TRANCHES[i].min) return IR_TRANCHES[i].rate;
    }
    return 0;
  }

  // ================================================================
  // QUOTIENT FAMILIAL
  //
  //  adults=1 : 1 part + 0,5 par enfant (1er et 2ème) + 1 par enfant (3ème+)
  //             + 0,5 supplémentaire si parent isolé avec enfant(s) (case T)
  //  adults=2 : 2 parts + même règle enfants
  // ================================================================

  /**
   * @param {{ adults: 1|2, isDualIncome: boolean, childrenAges: number[] }} family
   * @returns {number}
   */
  function calcNbParts(family) {
    const { adults, childrenAges } = family;
    let parts = adults;
    childrenAges.forEach((_, i) => { parts += i < 2 ? 0.5 : 1; });
    if (adults === 1 && childrenAges.length > 0) parts += 0.5; // parent isolé
    return parts;
  }

  // ================================================================
  // AIDES INDIVIDUELLES — RSA / Prime d'activité (personne seule)
  // Simplification : formule mono-adulte quel que soit le foyer.
  // ================================================================

  function _getBonification(net) {
    if (net <= 0)             return 0;
    if (net >= SMIC_NET)      return BONUS_PA;
    if (net > SMIC_NET * 0.5) return BONUS_PA * (net - SMIC_NET * 0.5) / (SMIC_NET * 0.5);
    return 0;
  }

  function calcIndividualAids(gross, net, includeAids) {
    if (!includeAids) return { rsa: 0, primeActivite: 0 };
    if (gross <= 0)   return { rsa: RSA_MAX, primeActivite: 0 };
    return {
      rsa:           0,
      primeActivite: Math.max(0, MF_PA + _getBonification(net) - 0.39 * net),
    };
  }

  // ================================================================
  // AIDES FAMILIALES
  // ================================================================

  /**
   * Allocations Familiales — enfants < 20 ans, modulation revenus.
   */
  function calcAF(family, annualNetImposable) {
    const eligible = family.childrenAges.filter(a => a < 20);
    const n = eligible.length;
    if (n < 2) return 0;

    const extra  = n - 2;
    const plafT1 = AF_PLAF_T1_BASE + extra * AF_PLAF_STEP;
    const plafT2 = AF_PLAF_T2_BASE + extra * AF_PLAF_STEP;

    const ratio = annualNetImposable <= plafT1 ? 1
                : annualNetImposable <= plafT2 ? 0.5
                : 0.25;

    // Base mensuelle selon nombre d'enfants
    const base = n === 2 ? AF_2ENF : AF_3ENF + (n - 3) * AF_SUPP;

    // Majoration pour âge : seuil 18 ans depuis la réforme mars 2026
    const nbMaj = eligible.filter(a => a >= 18).length;

    return (base + AF_MAJ_AGE * nbMaj) * ratio;
  }

  /**
   * PAJE Allocation de base — 1 allocation par enfant < 3 ans.
   * "biactif" = couple biactif OU parent seul (plafonds plus élevés).
   */
  function calcPAJE(family, annualNetImposable) {
    const { adults, isDualIncome, childrenAges } = family;
    const under3 = childrenAges.filter(a => a < 3).length;
    if (under3 === 0) return 0;

    const bi          = adults === 1 || isDualIncome;
    const extraChildren = Math.max(0, childrenAges.length - 1);
    const plafPlein   = (bi ? PAJE_PLAF_PLEIN_BI  : PAJE_PLAF_PLEIN_MONO)  + extraChildren * PAJE_PLAF_STEP;
    const plafPartiel = (bi ? PAJE_PLAF_PART_BI   : PAJE_PLAF_PART_MONO)   + extraChildren * PAJE_PLAF_STEP;

    const amount = annualNetImposable <= plafPlein   ? PAJE_PLEIN
                 : annualNetImposable <= plafPartiel ? PAJE_PARTIEL
                 : 0;
    return amount * under3;
  }

  /**
   * ARS — enfants 6-18 ans. Retourne le montant mensuel moyen (annuel ÷ 12).
   */
  function calcARS(family, annualNetImposable) {
    const { childrenAges } = family;
    const plafond = ARS_PLAF_BASE + Math.max(0, childrenAges.length - 1) * ARS_PLAF_STEP;
    if (annualNetImposable > plafond) return 0;

    let annualARS = 0;
    for (const age of childrenAges) {
      if      (age >= 6  && age <= 10) annualARS += ARS_6_10;
      else if (age >= 11 && age <= 14) annualARS += ARS_11_14;
      else if (age >= 15 && age <= 18) annualARS += ARS_15_18;
    }
    return annualARS / 12;
  }

  /**
   * Complément Familial — ≥ 3 enfants, TOUS âgés 3-21 ans.
   */
  function calcCF(family, annualNetImposable) {
    const { adults, isDualIncome, childrenAges } = family;
    const n = childrenAges.length;
    if (n < 3 || !childrenAges.every(a => a >= 3 && a <= 21)) return 0;

    const bi       = adults === 1 || isDualIncome;
    const extra    = n - 3;
    const plafMaj  = (bi ? CF_PLAF_MAJ_BI  : CF_PLAF_MAJ_MONO)  + extra * CF_PLAF_STEP;
    const plafBase = (bi ? CF_PLAF_BASE_BI : CF_PLAF_BASE_MONO) + extra * CF_PLAF_STEP;

    if (annualNetImposable <= plafMaj)  return CF_MAJORE;
    if (annualNetImposable <= plafBase) return CF_BASE;
    return 0;
  }

  // ================================================================
  // CALCUL COMPLET
  // ================================================================

  /**
   * @param {number}  grossMonthly
   * @param {{ adults: 1|2, isDualIncome: boolean, childrenAges: number[] }} family
   * @param {boolean} isCadre
   * @param {boolean} includeAids
   */
  function calculate(grossMonthly, family, isCadre, includeAids) {
    const { breakdown, totalCotisations, net, netImposable } =
      calcCotisations(grossMonthly, isCadre);

    const nbParts            = calcNbParts(family);
    const annualIR           = calcAnnualIR(netImposable, nbParts);
    const monthlyIR          = annualIR / 12;
    const annualNetImposable = netImposable * 12;

    const { rsa, primeActivite } = calcIndividualAids(grossMonthly, net, includeAids);
    const af   = includeAids ? calcAF(family, annualNetImposable)   : 0;
    const paje = includeAids ? calcPAJE(family, annualNetImposable) : 0;
    const ars  = includeAids ? calcARS(family, annualNetImposable)  : 0;
    const cf   = includeAids ? calcCF(family, annualNetImposable)   : 0;

    const aide  = rsa + primeActivite + af + paje + ars + cf;
    const total = net - monthlyIR + aide;

    const effectiveRate = annualNetImposable > 0 ? annualIR / annualNetImposable : 0;
    const marginalRate  = getMarginalRate(netImposable, nbParts);

    return {
      breakdown, totalCotisations, net, netImposable,
      nbParts, annualIR, monthlyIR, effectiveRate, marginalRate,
      rsa, primeActivite, af, paje, ars, cf,
      aide, total,
    };
  }

  // ================================================================
  // GÉNÉRATION DES DONNÉES POUR LE GRAPHIQUE
  // ================================================================

  function generateChartPoints(family, isCadre, includeAids) {
    const points = [];
    for (let gross = 0; gross <= MAX_GROSS; gross += STEP) {
      const r = calculate(gross, family, isCadre, includeAids);
      points.push({
        gross,
        net:        Math.round(r.net),
        netAfterIR: Math.round(r.net - r.monthlyIR),
        total:      Math.round(r.total),
      });
    }
    return points;
  }

  // ── Public API ──────────────────────────────────────────────
  return {
    calculate,
    generateChartPoints,
    calcNbParts,
    MAX_GROSS, STEP, PMSS, SMIC_GROSS, SMIC_NET, IR_TRANCHES,
  };

})();
