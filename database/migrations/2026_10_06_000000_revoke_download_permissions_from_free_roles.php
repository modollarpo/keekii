<?php

use Common\Permissions\Models\Permission;
use Common\Roles\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Revoke music.download and music.offline from the free listener roles.
 *
 * Why this exists
 * ---------------
 * resources/defaults/permissions.php grants neither permission to the "Users"
 * or "Guests" roles, but the production database still carried a stale
 * music.offline grant on the Guests role. BasePolicy::hasPermission() answers
 * from the guest role whenever the request is unauthenticated, so
 * `GET /tracks/{id}/download` served the real audio file to anonymous
 * visitors with no session at all (HTTP 200, audio/mpeg).
 *
 * Commit e3edbef removed the grant from the first-install seed only, so
 * already-installed databases were never corrected. ops/migrate-billing.php
 * holds the same strip step but is not wired into any deploy, and it also
 * rewrites live pricing as a side effect, so it is the wrong tool to reach
 * for here.
 *
 * This migration is idempotent and runs on every deploy through the
 * explicit-path step in .github/workflows/deploy.yml, next to the other
 * fixed-path migrations this project uses instead of a blanket `migrate`.
 *
 * Why roles are matched by name instead of by morph type
 * ------------------------------------------------------
 * permissionables.permissionable_type has held several different strings over
 * the life of this schema: the former FQCN, the legacy common\Foundation
 * namespace, and the short 'role' alias. Filtering on one guessed value is
 * how the original strip step deleted nothing and stayed silent, so the
 * candidate set is derived from the live model and widened with every value
 * the column has ever held. A row that matches none of them is left alone
 * rather than risk deleting a subscription grant.
 *
 * down() deliberately does nothing. Re-granting download to the guest role
 * would re-open the hole this migration closes, and recovering it by hand is
 * a one-line admin action if it is ever genuinely wanted.
 */
return new class extends Migration
{
    private const ROLE_NAMES = ['Users', 'Guests'];

    private const PERMISSION_NAMES = ['music.download', 'music.offline'];

    public function up(): void
    {
        $permissionIds = Permission::whereIn('name', self::PERMISSION_NAMES)
            ->pluck('id')
            ->all();

        if (count($permissionIds) !== count(self::PERMISSION_NAMES)) {
            Log::warning(
                'revoke_download_permissions: expected '.
                    implode(', ', self::PERMISSION_NAMES).
                    ', found '.implode(', ', $permissionIds).
                    ', nothing to do',
            );

            return;
        }

        $roleIds = DB::table('roles')
            ->whereIn('name', self::ROLE_NAMES)
            ->pluck('id')
            ->all();

        if (!$roleIds) {
            Log::warning(
                'revoke_download_permissions: no matching roles, nothing to do',
            );

            return;
        }

        $removed = DB::table('permissionables')
            ->whereIn('permissionable_id', $roleIds)
            ->whereIn('permissionable_type', $this->roleMorphTypes())
            ->whereIn('permission_id', $permissionIds)
            ->delete();

        Log::info(
            "revoke_download_permissions: removed {$removed} download grants from ".
                implode(', ', self::ROLE_NAMES),
        );
    }

    public function down(): void
    {
        //
    }

    /**
     * Every string permissionables.permissionable_type has plausibly held for
     * a role row, so a schema rename cannot quietly turn this into a no-op.
     */
    private function roleMorphTypes(): array
    {
        $types = [
            Role::MODEL_TYPE,
            Role::class,
            'App\\Models\\Role',
            'App\\Role',
            'Common\\Foundation\\Auth\\Roles\\Role',
            'common\\Foundation\\Auth\\Roles\\Role',
        ];

        try {
            $types[] = (new Role())->getMorphClass();
        } catch (\Throwable) {
            // The morph map is enforced without a 'role' entry in some boots,
            // which makes getMorphClass() throw instead of returning a value.
        }

        return array_values(array_unique($types));
    }
};
