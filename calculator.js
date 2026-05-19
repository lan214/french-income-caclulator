/**
 * calculator.js — French salary business logic (2026)
 *
 * Sources:
 *   - URSSAF / legisocial.fr — taux cotisations 2026
 *   - AGIRC-ARRCO — paramètres 2026
 *   - service-public.fr — barème IR 2026 (revenus 2025)
 *   - info.gouv.fr — SMIC 1er janvier 2026
 *   - quelles-aides.fr — Prime d'activité avril 2026
 *
 * No DOM. No Chart.js. Pure functions only.
 * Exposed via the global `CALC` namespace.
 */

const CALC = (() => {

  // ── Chart range ─────────────────────────────────────────────
  const MAX_GROSS = 15000; // € brut/mois
  const STEP      = 50;   // pas du graphique

  // ── Plafond de la Sécurité Sociale 2026 ─────────────────────
  const PMSS = 4005; // Plafond Mensuel  (PASS annuel = 48 060 €)

  // ── SMIC janvier 2026 (+1,18 % au 1er janvier 2026) ─────────
  const SMIC_GROSS = 1823.03;
  const SMIC_NET   = 1443.11; // net estimé (35 h)

  // ── Barème IR 2026 (revenus 2025, loi de finances 2026) ─────
  //    Revalorisation de 0,9 % par rapport au barème 2025.
  const IR_TRANCHES = [
    { min: 0,       max: 11600,  rate: 0    },
    { min: 11600,   max: 29579,  rate: 0.11 },
    { min: 29579,   max: 84577,  rate: 0.30 },
    { min: 84577,   max: 181917, rate: 0.41 },
    { min: 181917,  max: Infinity, rate: 0.45 },
  ];

  // Abattement forfaitaire frais professionnels 10 %
  const FP_RATE = 0.10;
  const FP_MIN  = 509;    // € (2026)
  const FP_MAX  = 14555;  // € (2026)

  // ── Aides sociales — barème avril 2026 ──────────────────────
  const RSA_MAX  = 651.69; // RSA personne seule
  const MF_PA    = 638.28; // Montant forfaitaire prime d'activité (personne seule)
  const BONUS_PA = 135;    // Bonification individuelle estimée au SMIC (2026)

  // ================================================================
  // COTISATIONS SALARIALES
  //
  //  Cadre et non-cadre partagent les mêmes taux AGIRC-ARRCO,
  //  CEG et CET depuis la fusion 2019.
  //  Seule différence côté salarié : l'APEC (cadres uniquement).
  //
  //  Cotisation              Base          Sal.    Employeur
  //  Vieillesse plafonnée    ≤ 1 PMSS      6,90 %   8,55 %
  //  Vieillesse déplafonnée  brut total    0,40 %   2,11 %
  //  AGIRC-ARRCO T1          ≤ 1 PMSS      3,15 %   4,72 %
  //  AGIRC-ARRCO T2          1→8 PMSS      8,64 %  12,95 %
  //  CEG T1                  ≤ 1 PMSS      0,86 %   1,29 %
  //  CEG T2                  1→8 PMSS      1,08 %   1,62 %
  //  CET                     T1+T2         0,14 %   0,21 %  (si brut > PMSS)
  //  APEC                    ≤ 4 PMSS      0,024%   0,036%  (cadres)
  //  CSG déductible          98,25 % brut  6,80 %
  //  CSG non-déductible      98,25 % brut  2,40 %   ← non déductible IR
  //  CRDS                    98,25 % brut  0,50 %   ← non déductible IR
  //
  //  Net imposable = net à payer + CSG_non_ded + CRDS
  // ================================================================

  /**
   * @param {number} grossMonthly  — salaire brut mensuel (€)
   * @param {boolean} isCadre
   * @returns {{
   *   breakdown: object,
   *   totalCotisations: number,
   *   net: number,          — net à payer
   *   netImposable: number  — base pour le calcul de l'IR
   * }}
   */
  function calcCotisations(grossMonthly, isCadre) {
    const T1      = Math.min(grossMonthly, PMSS);
    const T2      = Math.max(0, Math.min(grossMonthly, 8 * PMSS) - PMSS);
    const T1T2    = T1 + T2;
    const csgBase = grossMonthly * 0.9825; // abattement 1,75 % frais pro CSG/CRDS

    const vieillesse_plaf = T1          * 0.0690;
    const vieillesse_dep  = grossMonthly * 0.0040;
    const agirc_t1        = T1          * 0.0315;
    const agirc_t2        = T2          * 0.0864;
    const ceg_t1          = T1          * 0.0086;
    const ceg_t2          = T2          * 0.0108;
    const cet             = grossMonthly > PMSS ? T1T2 * 0.0014 : 0;
    const apec            = isCadre ? Math.min(grossMonthly, 4 * PMSS) * 0.00024 : 0;
    const csg_ded         = csgBase     * 0.0680;
    const csg_non_ded     = csgBase     * 0.0240;
    const crds            = csgBase     * 0.0050;

    const totalCotisations = vieillesse_plaf + vieillesse_dep
                           + agirc_t1 + agirc_t2
                           + ceg_t1 + ceg_t2 + cet + apec
                           + csg_ded + csg_non_ded + crds;

    const net          = grossMonthly - totalCotisations;
    const netImposable = net + csg_non_ded + crds; // CSG non-ded + CRDS réintégrés

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

  /**
   * Calcule l'IR annuel avec quotient familial.
   * @param {number} netImposableMonthly
   * @param {number} nbParts
   * @returns {number} IR annuel
   */
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

  /**
   * Retourne le Taux Marginal d'Imposition (TMI) atteint.
   * @param {number} netImposableMonthly
   * @param {number} nbParts
   * @returns {number} taux (0..0.45)
   */
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
  // AIDES SOCIALES — RSA / Prime d'activité (personne seule, 2026)
  //
  //  Formule officielle prime d'activité (personne seule) :
  //    PA = MF + bonification + 61 % × revenus_pro − ressources_totales
  //
  //  Pour un salarié seul dont les ressources = salaire net :
  //    PA = MF + bonification + 0,61×net − net
  //       = MF + bonification − 0,39×net
  //
  //  La bonification individuelle monte de 0 à BONUS_PA entre
  //  0,5×SMIC_net et 1×SMIC_net, puis reste constante.
  // ================================================================

  function _getBonification(net) {
    if (net <= 0)             return 0;
    if (net >= SMIC_NET)      return BONUS_PA;
    if (net > SMIC_NET * 0.5) return BONUS_PA * (net - SMIC_NET * 0.5) / (SMIC_NET * 0.5);
    return 0;
  }

  /**
   * @param {number} gross
   * @param {number} net
   * @param {boolean} includeAids
   * @returns {number} montant mensuel d'aides (€)
   */
  function calcAide(gross, net, includeAids) {
    if (!includeAids) return 0;
    if (gross <= 0)   return RSA_MAX;
    return Math.max(0, MF_PA + _getBonification(net) - 0.39 * net);
  }

  // ================================================================
  // CALCUL COMPLET — point d'entrée principal
  // ================================================================

  /**
   * @param {number}  grossMonthly
   * @param {number}  nbParts
   * @param {boolean} isCadre
   * @param {boolean} includeAids
   * @returns {{
   *   breakdown: object,
   *   totalCotisations: number,
   *   net: number,
   *   netImposable: number,
   *   annualIR: number,
   *   monthlyIR: number,
   *   effectiveRate: number,
   *   marginalRate: number,
   *   aide: number,
   *   total: number,
   * }}
   */
  function calculate(grossMonthly, nbParts, isCadre, includeAids) {
    const { breakdown, totalCotisations, net, netImposable } =
      calcCotisations(grossMonthly, isCadre);

    const annualIR    = calcAnnualIR(netImposable, nbParts);
    const monthlyIR   = annualIR / 12;
    const aide        = calcAide(grossMonthly, net, includeAids);
    const total       = net - monthlyIR + aide;

    const annualImposable = netImposable * 12;
    const effectiveRate   = annualImposable > 0 ? annualIR / annualImposable : 0;
    const marginalRate    = getMarginalRate(netImposable, nbParts);

    return {
      breakdown,
      totalCotisations,
      net,
      netImposable,
      annualIR,
      monthlyIR,
      effectiveRate,
      marginalRate,
      aide,
      total,
    };
  }

  // ================================================================
  // GÉNÉRATION DES DONNÉES POUR LE GRAPHIQUE
  //
  //  Retourne des points bruts — sans aucun formatage Chart.js.
  //  La couche UI est responsable de construire les datasets.
  // ================================================================

  /**
   * @returns {Array<{gross, net, netAfterIR, total}>}
   */
  function generateChartPoints(nbParts, isCadre, includeAids) {
    const points = [];
    for (let gross = 0; gross <= MAX_GROSS; gross += STEP) {
      const r = calculate(gross, nbParts, isCadre, includeAids);
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
    // Core calculations
    calculate,
    generateChartPoints,
    // Constants exposed for UI markers / labels
    MAX_GROSS,
    STEP,
    PMSS,
    SMIC_GROSS,
    SMIC_NET,
    IR_TRANCHES,
  };

})();
