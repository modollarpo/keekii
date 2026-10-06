import {Product} from '@app/gen/schemas/product';
import {UpsellBillingCycle} from '@common/billing/pricing-table/find-best-price';
import {Trans} from '@ui/i18n/trans';
import {cn} from '@ui/utils/cn';
import {useEffect, useState} from 'react';

import {PricingPlanCard} from './pricing-plan-card';
import {
  groupPricingProducts,
  PricingGroupId,
  premiumTiers,
} from './pricing-groups';

type GroupedPricingTableProps = {
  products: Product[];
  selectedCycle: UpsellBillingCycle;
  className?: string;
};

/**
 * The pricing page as three groups -- Free, Pro Unlimited, Keekii Premium --
 * rather than one flat row of every product in the catalogue.
 *
 * Keekii Premium holds four tiers, so the group gets a switch of its own and
 * shows one plan at a time. Four cards side by side is what the flat table used
 * to do, and it read as four unrelated products rather than one plan with four
 * sizes; switching keeps the shared Premium benefits on screen while the price
 * and the account count change underneath.
 */
export function GroupedPricingTable({
  products,
  selectedCycle,
  className,
}: GroupedPricingTableProps) {
  const groups = groupPricingProducts(products);
  const [activeGroup, setActiveGroup] = useState<PricingGroupId | null>(null);
  const [activeTierKey, setActiveTierKey] = useState<string | null>(null);

  const group =
    groups.find(item => item.id === activeGroup) ?? groups[0] ?? null;

  // Keep the selected tier valid when the catalogue or the billing cycle
  // changes underneath us, otherwise the group can point at a product that is
  // no longer on offer.
  const tiers = group?.id === 'premium' ? premiumTiers(group.products) : [];
  const activeTier =
    tiers.find(tier => tier.key === activeTierKey) ?? tiers[0] ?? null;

  useEffect(() => {
    if (group && group.id !== activeGroup) {
      setActiveGroup(group.id);
    }
  }, [group, activeGroup]);

  if (!group) return null;

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <div
        role="tablist"
        aria-label="Plan groups"
        className="flex flex-wrap justify-center gap-2"
      >
        {groups.map(item => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={item.id === group.id}
            onClick={() => setActiveGroup(item.id)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              item.id === group.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <Trans message={item.label} />
          </button>
        ))}
      </div>

      {group.id === 'premium' && tiers.length > 1 ? (
        <PremiumTierSwitch
          tiers={tiers}
          activeKey={activeTier?.key ?? null}
          onChange={setActiveTierKey}
        />
      ) : null}

      {group.id === 'premium' && activeTier ? (
        <div className="flex justify-center">
          <PricingPlanCard
            key={activeTier.product.id}
            plan={activeTier.product}
            selectedCycle={selectedCycle}
          />
        </div>
      ) : (
        // The Keekii Premium group shows one tier at a time, but Free can hold
        // more than one plan when the catalogue carries free products besides
        // Keekii Free, so this is a grid rather than a centred flex row: the
        // cards need to wrap instead of colliding.
        <div
          className={cn(
            'grid items-start justify-items-center gap-6',
            group.products.length > 1 && 'md:grid-cols-2',
          )}
        >
          {group.products.map(product => (
            <PricingPlanCard
              key={product.id}
              plan={product}
              selectedCycle={selectedCycle}
              className="w-full max-w-sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The Individual / Duo / Family / Student switch inside Keekii Premium. */
function PremiumTierSwitch({
  tiers,
  activeKey,
  onChange,
}: {
  tiers: {key: string; label: string; product: Product}[];
  activeKey: string | null;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Keekii Premium tiers"
      className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full bg-muted p-1"
    >
      {tiers.map(tier => {
        const isActive = tier.key === activeKey;
        return (
          <button
            key={tier.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tier.key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Trans message={tier.label} />
          </button>
        );
      })}
    </div>
  );
}