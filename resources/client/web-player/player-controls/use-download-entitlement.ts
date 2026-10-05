import {useAuth} from '@common/auth/use-auth';
import {useSettings} from '@ui/settings/use-settings';

export type DownloadEntitlement = {
  /**
   * Whether this build has downloads switched on at all. False means the
   * feature is turned off server-wide and no upsell is appropriate either.
   */
  enabled: boolean;
  /** The listener may actually download right now. */
  canDownload: boolean;
  /**
   * Downloads are possible but this listener is not entitled to them, and
   * billing is live, so offer the upgrade path instead of hiding the control.
   * False when billing is disabled, because then there is nothing to upgrade to
   * and a prompt would be a dead end.
   */
  shouldPromptUpgrade: boolean;
};

/**
 * Single source of truth for download entitlement in the UI.
 *
 * The server enforces this in TrackPolicy::download as
 * `music.download || music.offline`. Checking the same pair here keeps the
 * interface honest: a listener without either permission sees an upgrade
 * prompt, and one with either gets the real button.
 *
 * Both the player control and the track context menu used to gate on
 * `music.download` alone and return null otherwise, which meant Premium's
 * advertised offline downloads were unreachable from the interface entirely.
 */
export function useDownloadEntitlement(): DownloadEntitlement {
  const {player, billing} = useSettings();
  const {hasPermission, isSubscribed} = useAuth();

  const enabled = Boolean(player?.enable_download);

  if (!enabled) {
    return {enabled: false, canDownload: false, shouldPromptUpgrade: false};
  }

  const canDownload =
    hasPermission('music.download') || hasPermission('music.offline');

  return {
    enabled,
    canDownload,
    shouldPromptUpgrade:
      !canDownload && Boolean(billing?.enable) && !isSubscribed,
  };
}