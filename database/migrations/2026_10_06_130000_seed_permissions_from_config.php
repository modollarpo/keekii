<?php

use Common\Database\Seeders\PermissionTableSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * Sync resources/defaults/permissions.php into the permissions table.
 *
 * resources/defaults/permissions.php is the permission catalogue, but the
 * table is only seeded on first install - the same reason the sidebar nav
 * migration above exists. The catalogue has grown since this database was
 * installed, most recently by the four ads.* permissions that /admin/ads and
 * AdPolicy are written against, so without this only an admin can reach the
 * ads screen: admins bypass permission checks outright, and no other role can
 * be granted ads.view because there is no row to grant.
 *
 * Additive only. PermissionTableSeeder is updateOrCreate on name, so nothing
 * that already exists is rewritten and nothing is ever deleted - a row cannot
 * be removed here to disable a feature, since hasPermission would then deny
 * every non-admin user of that feature instead.
 */
return new class extends Migration {
    public function up(): void
    {
        app(PermissionTableSeeder::class)->run();
    }

    public function down(): void
    {
        // Deliberately empty: this migration cannot tell which rows it added
        // from which were already there, and dropping permission rows would
        // revoke grants that roles already carry.
    }
};
