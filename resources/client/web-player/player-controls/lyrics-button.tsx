import {useCuedAd} from '@app/web-player/ads/use-cued-ad';
import {useCuedTrack} from '@app/web-player/player-controls/use-cued-track';
import {useIsOffline} from '@app/web-player/use-is-offline';
import {useNavigate} from '@common/ui/navigation/use-navigate';
import {Button} from '@shadcn/button/button';
import {Tooltip} from '@shadcn/tooltip/tooltip';
import {Trans} from '@ui/i18n/trans';
import {MediaMicrophoneIcon} from '@ui/icons/media/media-microphone';
import {useSettings} from '@ui/settings/use-settings';
import {useLocation, useMatch} from 'react-router';

export function LyricsButton() {
  const {player} = useSettings();
  const track = useCuedTrack();
  const ad = useCuedAd();
  const navigate = useNavigate();
  const isOnLyricsPage = !!useMatch('/lyrics');
  const {key} = useLocation();
  const hasPreviousUrl = key !== 'default';
  const isOffline = useIsOffline();
  const isDisabled = isOffline || !track || player?.hide_lyrics;

  // an ad has no lyrics to fetch; the cued meta merely looks like a track
  if (ad || !track || player?.hide_lyrics) {
    return null;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            disabled={isDisabled}
            onClick={() => {
              if (isOnLyricsPage) {
                if (hasPreviousUrl) {
                  navigate(-1);
                }
              } else {
                navigate(`/lyrics`);
              }
            }}
            color={isOnLyricsPage ? 'primary' : undefined}
            variant="ghost"
            size="icon"
          />
        }
      >
        <MediaMicrophoneIcon className="size-6" />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <Trans message="Lyrics" />
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
