<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Add the "Ads" entry to the existing admin sidebar menu.
 *
 * resources/defaults/default-settings.php seeds the menus setting on first
 * install only, so already installed databases would otherwise never get a
 * link to /admin/ads and the player ads feature would be unreachable from
 * the admin UI.
 */
return new class extends Migration {
    private const ITEM = [
        'label' => 'Ads',
        'action' => '/admin/ads',
        'type' => 'route',
        'target' => '_self',
        'permissions' => ['ads.view'],
    ];

    // insert after whichever of these is already present, in that order
    private const ANCHORS = ['/admin/subscriptions', '/admin/tags'];

    public function up(): void
    {
        $this->mutate(function (array $menus): array {
            foreach ($menus as &$menu) {
                if (!$this->isAdminSidebar($menu)) {
                    continue;
                }

                $items = $menu['items'] ?? [];
                foreach ($items as $item) {
                    if (($item['action'] ?? null) === self::ITEM['action']) {
                        return $menus;
                    }
                }

                $insertAt = $this->anchorIndex($items);
                if ($insertAt === null) {
                    $items[] = self::ITEM;
                } else {
                    array_splice($items, $insertAt + 1, 0, [self::ITEM]);
                }
                $menu['items'] = $items;

                return $menus;
            }

            return $menus;
        });
    }

    public function down(): void
    {
        $this->mutate(function (array $menus): array {
            foreach ($menus as &$menu) {
                if (!$this->isAdminSidebar($menu)) {
                    continue;
                }
                $menu['items'] = array_values(
                    array_filter(
                        $menu['items'] ?? [],
                        fn($item) =>
                            ($item['action'] ?? null) !== self::ITEM['action'],
                    ),
                );
            }

            return $menus;
        });
    }

    private function mutate(callable $callback): void
    {
        $row = DB::table('settings')
            ->where('name', 'menus')
            ->first();

        if (!$row || !is_string($row->value)) {
            return;
        }

        $menus = json_decode($row->value, true);
        if (!is_array($menus)) {
            return;
        }

        $updated = $callback($menus);

        DB::table('settings')
            ->where('name', 'menus')
            ->update(['value' => json_encode($updated)]);
    }

    private function isAdminSidebar(array $menu): bool
    {
        if (($menu['id'] ?? null) === '2d43u1') {
            return true;
        }

        return in_array('admin-sidebar', $menu['positions'] ?? [], true);
    }

    private function anchorIndex(array $items): int|null
    {
        foreach (self::ANCHORS as $anchor) {
            foreach ($items as $index => $item) {
                if (($item['action'] ?? null) === $anchor) {
                    return $index;
                }
            }
        }

        return null;
    }
};
