import {useCanOffline} from '@app/offline/use-can-offline';
import {useAuth} from '@common/auth/use-auth';
import {useCustomMenu} from '@common/menus/use-custom-menu';
import {MenuItemConfig} from '@common/menus/menu-config';
import {useSettings} from '@ui/settings/use-settings';

/**
 * Menu data shared by the player sidebar and the burger menu on pages that have
 * no sidebar (the landing page and the company pages).
 *
 * Only the *data* lives here, deliberately: `Sidebar.MenuButton` and friends
 * require the dashboard layout context, which the company and landing pages do
 * not have, so the two surfaces render the same items with their own markup
 * instead. Keeping the filtering rules in one place is what stops the two menus
 * from drifting apart.
 *
 * The full `MenuItemConfig` is returned rather than a trimmed shape so both
 * surfaces keep the admin-configured icon, label and ordering.
 */

/** "Home" points at the homepage channel, unless we are on the landing page. */
export function usePrimaryMenuItems(): MenuItemConfig[] {
  const menu = useCustomMenu('sidebar-primary');
  const {homepage} = useSettings();
  const {isLoggedIn} = useAuth();

  return (menu?.items ?? []).map(item => {
    // make sure "home" menu item leads to homepage channel and not landing page,
    // when homepage is set to landing page and user is not logged in.
    let action = item.action;
    if (action === '/' && homepage?.type === 'landingPage' && !isLoggedIn) {
      action = '/discover';
    }
    return {...item, action};
  });
}

export function useSecondaryMenuItems(): MenuItemConfig[] {
  const menu = useCustomMenu('sidebar-secondary');
  const canOffline = useCanOffline();

  return (menu?.items ?? []).filter(
    item => item.action !== '/library/downloads' || canOffline,
  );
}