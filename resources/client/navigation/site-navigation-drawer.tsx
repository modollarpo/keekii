import {
  usePrimaryMenuItems,
  useSecondaryMenuItems,
} from '@app/web-player/layout/player-menu-items';
import {webPlayerSidebarIcons} from '@app/web-player/layout/web-player-sidebar-icons';
import {getCompanyNavGroups} from '@app/company/company-site-map';
import {MenuItemIcon} from '@common/menus/custom-menu';
import {MenuItemConfig} from '@common/menus/menu-config';
import {Button} from '@shadcn/button/button';
import {Drawer} from '@shadcn/drawer/drawer';
import {Trans} from '@ui/i18n/trans';
import {MenuIcon} from 'lucide-react';
import {useState} from 'react';
import {NavLink} from 'react-router';

/**
 * Burger menu for the pages that have no sidebar of their own: the landing
 * page and the company/marketing pages.
 *
 * It intentionally reuses the player's primary and secondary menus -- the same
 * admin-configured items the player sidebar shows -- and appends the company
 * site map, so a visitor who lands on `/about` can still reach the player. What
 * it does not reuse is the sidebar chrome: `Sidebar.*` needs the dashboard
 * layout context these pages do not have, hence the plain list markup here.
 */
export function SiteNavigationDrawer() {
  const [open, setOpen] = useState(false);
  const primaryItems = usePrimaryMenuItems();
  const secondaryItems = useSecondaryMenuItems();
  const companyGroups = getCompanyNavGroups();

  return (
    <Drawer.Root position="left" open={open} onOpenChange={setOpen}>
      <Drawer.Trigger
        // `size="icon"` is the same control the shared Navbar.Menu renders for
        // its own burger (navbar.tsx), so the two read identically in the bar.
        render={<Button variant="ghost" size="icon" />}
        aria-label="Open menu"
        className="shrink-0"
      >
        <MenuIcon />
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Content popupClassName="p-0">
          <div className="flex h-full w-full flex-col overflow-y-auto p-4">
            <DrawerGroup
              label=""
              items={primaryItems}
              onNavigate={() => setOpen(false)}
            />

            {secondaryItems.length ? (
              <DrawerGroup
                label="Library"
                items={secondaryItems}
                onNavigate={() => setOpen(false)}
              />
            ) : null}

            {companyGroups.map(group => (
              <DrawerGroup
                key={group.title}
                label={group.title}
                items={group.items.map(item => ({
                  id: item.to,
                  type: 'route',
                  order: 0,
                  label: item.label,
                  action: item.to,
                }))}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function DrawerGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: MenuItemConfig[];
  /** Closes the drawer so the menu never covers the page just opened. */
  onNavigate: () => void;
}) {
  if (!items.length) return null;

  return (
    <div className="mb-5 last:mb-0">
      {label ? (
        <p className="mb-1.5 px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          <Trans message={label} />
        </p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {items.map(item => (
          <li key={item.id}>
            <NavLink
              to={item.action}
              onClick={onNavigate}
              className={({isActive}) =>
                `flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-muted ${
                  isActive ? 'bg-muted text-primary' : 'text-foreground'
                }`
              }
            >
              {webPlayerSidebarIcons[item.action.split('?')[0]] ? (
                <MenuItemIcon item={item} defaultIcons={webPlayerSidebarIcons} />
              ) : null}
              <Trans message={item.label} />
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}