import {useDownloadEntitlement} from '@app/web-player/player-controls/use-download-entitlement';
import {useCuedTrack} from '@app/web-player/player-controls/use-cued-track';
import {trackIsLocallyUploaded} from '@app/web-player/tracks/utils/track-is-locally-uploaded';
import {useIsOffline} from '@app/web-player/use-is-offline';
import {Button, LinkButton} from '@shadcn/button/button';
import {Tooltip} from '@shadcn/tooltip/tooltip';
import {Trans} from '@ui/i18n/trans';
import {useSettings} from '@ui/settings/use-settings';
import {downloadFileFromUrl} from '@ui/utils/files/download-file-from-url';
import {DownloadIcon, LockIcon} from 'lucide-react';

export function DownloadTrackButton() {
  const {player, base_url} = useSettings();
  const track = useCuedTrack();
  const isOffline = useIsOffline();
  const {canDownload, shouldPromptUpgrade} = useDownloadEntitlement();

  // enable_download is a site-wide admin switch and stays authoritative: if it
  // is off, no listener sees an upgrade prompt either.
  if (!player?.enable_download || !track || !trackIsLocallyUploaded(track) || isOffline) {
    return null;
  }

  // Entitlement-shaped rather than hidden: a listener without the permission
  // gets sent to /pricing instead of a control that silently does nothing.
  if (shouldPromptUpgrade) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger render={<LinkButton to="/pricing" />}>
          <LockIcon className="size-5" />
        </Tooltip.Trigger>
        <Tooltip.Content>
          <Trans message="Upgrade to download" />
        </Tooltip.Content>
      </Tooltip.Root>
    );
  }

  if (!canDownload) {
    return null;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              downloadFileFromUrl(`${base_url}/tracks/${track.id}/download`);
            }}
          />
        }
      >
        <DownloadIcon className="size-5" />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <Trans message="Download" />
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
