<?php

use Common\Billing\Models\Product;
use Common\Billing\Products\CrupdateProduct;
use Common\Permissions\Models\Permission;
use Common\Settings\Models\Setting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Realign the seeded billing products with the five listener plans that
 * resources/client/company/plans/plan-data.ts already publishes on /plans, and
 * enable billing so product permissions actually resolve.
 *
 * Why this exists
 * ---------------
 * BillingPlanSeeder created "Basic" and "Pro Unlimited". plan-data.ts ships
 * "Keekii Free" and Premium Individual/Duo/Family/Student, and those marketing
 * pages already promise "No advertising" and "Offline downloads". None of that
 * was backed: the default Users role grants neither music.download nor
 * music.offline (resources/defaults/permissions.php) and the seeded plans
 * attached only music.create, so no product granted download at all.
 *
 * This migration attaches those permissions to the Premium plans so the copy
 * is finally true, and flips billing.enable so plan permissions can resolve
 * at all.
 *
 * Quality claim: plan-data.ts also advertises "Highest audio quality". That is
 * NOT fixed here and remains an open item. There are no multi-bitrate variants
 * in the audio pipeline - tracks resolve to a single source file, and the only
 * multi-bitrate path is the highest-quality YouTube source. So this migration
 * deliberately copies no quality claim onto the products rather than
 * fabricating one. Fixing the marketing copy is a separate change.
 *
 * Gateway note: only billing.enable is set here. billing.stripe.enable and
 * billing.paypal.enable are deliberately left alone, so whatever the gateway
 * state was before this migration is preserved.
 *
 * Stripe/PayPal products are still created as a side effect of seeding:
 * CrupdateProduct is called with its default syncProduct: true, which routes
 * each non-free product through SyncProductOnEnabledGateways. That step is
 * mandatory, not cosmetic - without it the new plans exist only in the local
 * database with no stripe_id on their prices, and with live keys a customer
 * reaches checkout with nothing to pay for.
 *
 * Idempotent: re-running updates the products in place by name.
 */
return new class extends Migration
{
    /**
     * PROPOSED PRICING - not a business decision that has been approved.
     *
     * plan-data.ts intentionally carries no prices so marketing copy cannot
     * drift from what a listener is charged, and the project owner delegated
     * the pricing logic to this migration. These figures are therefore a
     * starting point, chosen to be editable in one place:
     *
     *   - Individual is the anchor at $9/mo.
     *   - 6- and 12-month terms carry roughly 17% and 33% discounts against the
     *     monthly rate, so annual is meaningfully cheaper per month.
     *   - Duo is 1.5x Individual, Family 2x, Student 0.6x. Seats are billed per
     *     account, not per household, matching the copy in plan-data.ts
     *     ("Everything in Premium Individual, twice" / "six times over").
     *   - Rounded to whole dollars because a marketplace catalogue does not
     *     need cent-level precision and it keeps every plan readable at a
     *     glance on /pricing. The discounts above are 16.7% and 33.3%, which is
     *     what the whole-dollar figures actually produce.
     *
     * To change: edit the arrays in planPrices() below and re-run.
     */
    private function planPrices(): array
    {
        return [
            'Keekii Premium Individual' => [
                ['amount' => 9, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 1],
                ['amount' => 57, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 6],
                ['amount' => 80, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 12],
            ],
            'Keekii Premium Duo' => [
                ['amount' => 15, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 1],
                ['amount' => 90, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 12],
            ],
            'Keekii Premium Family' => [
                ['amount' => 20, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 1],
                ['amount' => 120, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 12],
            ],
            'Keekii Premium Student' => [
                ['amount' => 6, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 1],
                ['amount' => 48, 'currency' => 'USD', 'interval' => 'month', 'interval_count' => 12],
            ],
        ];
    }

    public function up(): void
    {
        // Seed first, flip the flag second. Seeding is what creates the Stripe
        // and PayPal products and prices, via SyncProductOnEnabledGateways,
        // because CrupdateProduct is left at its default syncProduct: true.
        $this->seedPlans();
        $this->enableBilling();
    }

    public function down(): void
    {
        // Deliberately only reverses the flag. Deleting products would cascade
        // through permissionables and subscriptions, destroying live customer
        // data, so a plan rollback has to be done by hand in the admin panel.
        Setting::firstOrNew(['name' => 'billing.enable'])->update(['value' => 'false']);
    }

    private function enableBilling(): void
    {
        $setting = Setting::firstOrNew(['name' => 'billing.enable']);
        $setting->value = true;

        if ($setting->save()) {
            Log::info('billing.enable set to true');
        }
    }

    private function seedPlans(): void
    {
        $permissionIds = Permission::pluck('id', 'name');

        // Guard every permission name up front. syncPermissions() indexes this
        // array directly, so a missing key would throw rather than skip.
        $required = ['music.download', 'music.offline'];
        $missing = array_diff($required, array_keys($permissionIds->all()));

        if ($missing) {
            Log::warning(
                'Skipping plan seeding, permissions not synced yet: '.
                implode(', ', $missing),
            );

            return;
        }

        $premiumPermissions = [
            ['id' => $permissionIds['music.download']],
            ['id' => $permissionIds['music.offline']],
        ];

        $crupdate = app(CrupdateProduct::class);
        $prices = $this->planPrices();

        // Free: no download, no offline. Deliberately does not grant
        // music.create either - uploading is the separate creator axis, gated by
        // the Artists role, not by a listener subscription.
        $this->upsertProduct($crupdate, [
            'name' => 'Keekii Free',
            'free' => true,
            'position' => 1,
            'feature_list' => [
                'The full Keekii catalogue across every genre',
                'Playlists, channels and personalised recommendations',
                'Lyrics on every track that has them',
                'Follow artists and build a library',
                'Ad-supported listening',
                'Online playback only',
                'One account',
            ],
            'permissions' => [],
        ]);

        $premiums = [
            [
                'name' => 'Keekii Premium Individual',
                'position' => 2,
                'recommended' => true,
                'feature_list' => [
                    'Everything in Keekii Free',
                    'No advertising',
                    'Offline downloads on up to 5 devices',
                    'Download songs',
                    'Lyrics view',
                ],
            ],
            [
                'name' => 'Keekii Premium Duo',
                'position' => 3,
                'feature_list' => [
                    'Everything in Premium Individual, twice',
                    '2 separate accounts',
                    'No advertising',
                    'Offline downloads on both accounts',
                ],
            ],
            [
                'name' => 'Keekii Premium Family',
                'position' => 4,
                'feature_list' => [
                    'Everything in Premium Individual, six times over',
                    'Up to 6 separate accounts',
                    '1 account available while travelling',
                    'No advertising',
                    'Offline downloads',
                ],
            ],
            [
                'name' => 'Keekii Premium Student',
                'position' => 5,
                'trial_period_days' => 0,
                'feature_list' => [
                    'Everything in Premium Individual',
                    'Student rate',
                    'No advertising',
                    'Offline downloads',
                ],
            ],
        ];

        foreach ($premiums as $premium) {
            $this->upsertProduct($crupdate, array_merge($premium, [
                'permissions' => $premiumPermissions,
                'prices' => $prices[$premium['name']] ?? [],
            ]));
        }
    }

    private function upsertProduct(CrupdateProduct $crupdate, array $data): void
    {
        $existing = Product::where('name', $data['name'])->first();

        // syncProduct stays at its default of true so CrupdateProduct hands the
        // product to SyncProductOnEnabledGateways. That is what actually
        // creates the Stripe product and the per-price stripe_id rows, and it
        // is gated on isEnabled() for each gateway, so a disabled gateway is
        // skipped rather than failing.
        //
        // This has to be true. Passing false would leave the plans local-only:
        // /pricing would advertise products that do not exist on Stripe, their
        // prices would have no stripe_id, and a customer with live keys would
        // reach checkout and find nothing to pay for.
        $crupdate->execute($data, $existing);
    }
};
