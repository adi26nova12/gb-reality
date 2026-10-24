import { formatBudgetRange, formatCompactPrice } from "./money";

/**
 * Deterministic, explainable property matching. No scoring model: every
 * property is put into a tier using simple rules an agent can verify.
 *
 *  exact — selected development, requested configuration, within budget
 *  close — selected development, but either the configuration or the budget differs
 *  other — a different development with the requested configuration within budget
 *
 * Properties that are archived or not "available" are never suggested.
 */

export interface MatchCriteria {
  developmentId: string;
  configuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string;
}

export interface CandidateProperty {
  id: string;
  developmentId: string;
  developmentName: string;
  unitReference: string;
  configuration: string;
  price: number | null;
  currency: string;
  availabilityStatus: string;
  archived: boolean;
}

export type BudgetFit = "within" | "below" | "above" | "unknown" | "not_specified";
export type MatchTier = "exact" | "close" | "other";

export interface MatchResult<P extends CandidateProperty = CandidateProperty> {
  property: P;
  tier: MatchTier;
  developmentMatch: boolean;
  configurationMatch: boolean;
  budget: BudgetFit;
  reasons: string[];
}

export interface MatchSummary<P extends CandidateProperty = CandidateProperty> {
  exact: MatchResult<P>[];
  close: MatchResult<P>[];
  other: MatchResult<P>[];
  hasExactMatch: boolean;
  unavailableExcluded: number;
}

export function evaluateBudget(
  price: number | null,
  currency: string,
  min: number | null,
  max: number | null,
  budgetCurrency: string,
): BudgetFit {
  if (min === null && max === null) return "not_specified";
  // Never claim a property is within budget when we cannot compare like for like.
  if (price === null || currency !== budgetCurrency) return "unknown";
  if (min !== null && price < min) return "below";
  if (max !== null && price > max) return "above";
  return "within";
}

function budgetReason(fit: BudgetFit, p: CandidateProperty, c: MatchCriteria): string {
  const price = formatCompactPrice(p.price, p.currency);
  const range = formatBudgetRange(c.budgetMin, c.budgetMax, c.budgetCurrency);
  switch (fit) {
    case "within":
      return `${price} is within the ${range} budget`;
    case "above":
      return `${price} is ${formatCompactPrice((p.price ?? 0) - (c.budgetMax ?? 0), p.currency)} above the budget maximum`;
    case "below":
      return `${price} is below the budget minimum of ${formatCompactPrice(c.budgetMin, c.budgetCurrency)}`;
    case "unknown":
      return p.price === null
        ? "Price on request, so the budget cannot be checked"
        : `Priced in ${p.currency}, so it cannot be compared with a ${c.budgetCurrency} budget`;
    case "not_specified":
      return `${price} (no budget specified)`;
  }
}

const budgetOk = (fit: BudgetFit) => fit === "within" || fit === "not_specified";

const budgetOrder: Record<BudgetFit, number> = { within: 0, not_specified: 0, below: 1, above: 2, unknown: 3 };

function compare(a: MatchResult, b: MatchResult): number {
  if (a.configurationMatch !== b.configurationMatch) return a.configurationMatch ? -1 : 1;
  const budget = budgetOrder[a.budget] - budgetOrder[b.budget];
  if (budget !== 0) return budget;
  const pa = a.property.price ?? Number.POSITIVE_INFINITY;
  const pb = b.property.price ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return a.property.unitReference.localeCompare(b.property.unitReference);
}

export function matchProperties<P extends CandidateProperty>(criteria: MatchCriteria, candidates: P[]): MatchSummary<P> {
  const exact: MatchResult<P>[] = [];
  const close: MatchResult<P>[] = [];
  const other: MatchResult<P>[] = [];
  let unavailableExcluded = 0;

  for (const property of candidates) {
    if (property.archived || property.availabilityStatus !== "available") {
      unavailableExcluded += 1;
      continue;
    }
    const developmentMatch = property.developmentId === criteria.developmentId;
    const configurationMatch = property.configuration === criteria.configuration;
    const budget = evaluateBudget(property.price, property.currency, criteria.budgetMin, criteria.budgetMax, criteria.budgetCurrency);

    const reasons = [
      developmentMatch ? `In ${property.developmentName}` : `In a different development (${property.developmentName})`,
      configurationMatch ? `${property.configuration} as requested` : `${property.configuration}, not the requested ${criteria.configuration}`,
      budgetReason(budget, property, criteria),
    ];

    let tier: MatchTier | null = null;
    if (developmentMatch && configurationMatch && budgetOk(budget)) tier = "exact";
    else if (developmentMatch && (configurationMatch || budgetOk(budget))) tier = "close";
    else if (!developmentMatch && configurationMatch && budgetOk(budget)) tier = "other";
    if (!tier) continue;

    const result: MatchResult<P> = { property, tier, developmentMatch, configurationMatch, budget, reasons };
    (tier === "exact" ? exact : tier === "close" ? close : other).push(result);
  }

  exact.sort(compare);
  close.sort(compare);
  other.sort(compare);
  return { exact, close, other, hasExactMatch: exact.length > 0, unavailableExcluded };
}
