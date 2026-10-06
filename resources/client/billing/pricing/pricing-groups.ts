import {Product} from '@app/gen/schemas/product';

export type PricingGroupId = 'free' | 'pro-unlimited' | 'premium';

export type PricingGroup = {
  id: PricingGroupId;
  label: string;
  products: Product[];
};

export type PremiumTier = {
  /** Stable key used by the toggle, derived from the product name. */
  key: string;
  /** Short label for the toggle, e.g. "Duo". */
  label: string;
  product: Product;
};

/**
 * The pricing page shows three groups rather than one flat row of products.
 *
 * The catalogue carries legacy products alongside the current Keekii ones, so
 * the grouping is derived from the product name instead of a new database flag:
 * that keeps existing subscribers and their prices untouched and means a plan
 * added in admin lands in the right group without a code change.
 */
export function groupPricingProducts(products: Product[]): PricingGroup[] {
  const visible = products.filter(plan => !plan.hidden);

  const free = preferCurrentFreePlan(visible.filter(plan => plan.free));
  const proUnlimited = visible.filter(plan =>
    /pro\s*unlimited/i.test(plan.name),
  );
  const premium = visible.filter(
    plan => !plan.free && !proUnlimited.includes(plan) && /premium/i.test(plan.name),
  );

  const groups: PricingGroup[] = [
    {id: 'free', label: 'Free', products: free},
    {id: 'pro-unlimited', label: 'Pro Unlimited', products: proUnlimited},
    {id: 'premium', label: 'Keekii Premium', products: sortPremiumTiers(premium)},
  ];

  // Drop a group with nothing in it rather than rendering an empty tab.
  return groups.filter(group => group.products.length > 0);
}

/**
 * The catalogue still carries the legacy free product next to Keekii Free, and
 * both are flagged free, so the Free group would otherwise show two cards that
 * cost the same thing side by side and read as a choice. Show only the current
 * Keekii plan when one is on offer, and fall back to the whole free list if
 * there is no match so a free plan can never drop off the pricing page.
 */
function preferCurrentFreePlan(free: Product[]): Product[] {
  const current = free.filter(plan => /keekii\s*free/i.test(plan.name));
  return current.length ? current : free;
}

/**
 * Individual, Duo, Family, Student is the order people expect, and it happens
 * to run from cheapest to dearest except for Student, which is discounted and so
 * would otherwise sort oddly if it were matched on price alone.
 */
const TIER_ORDER = ['individual', 'duo', 'family', 'student'];

function premiumTierKey(name: string): string {
  const lowered = name.toLowerCase();
  return TIER_ORDER.find(tier => lowered.includes(tier)) ?? lowered;
}

function sortPremiumTiers(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(premiumTierKey(a.name));
    const bi = TIER_ORDER.indexOf(premiumTierKey(b.name));
    if (ai === bi) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/**
 * The toggle entries for the Keekii Premium group. "Premium" is dropped from the
 * label because the group heading already says it, so the row reads
 * "Individual | Duo | Family | Student".
 */
export function premiumTiers(products: Product[]): PremiumTier[] {
  return products.map(product => {
    const key = premiumTierKey(product.name);
    const withoutPrefix = product.name.replace(/keekii\s*premium\s*/i, '').trim();
    return {
      key,
      label: withoutPrefix || product.name,
      product,
    };
  });
}