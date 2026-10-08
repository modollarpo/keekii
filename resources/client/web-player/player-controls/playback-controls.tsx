import {AdNextButton, AdPreviousButton} from '@app/web-player/ads/ad-controls';
import {useCuedAd} from '@app/web-player/ads/use-cued-ad';
import {BufferingIndicator} from '@app/web-player/player-controls/buffering-indicator';
import {MainSeekbar} from '@app/web-player/player-controls/seekbar/main-seekbar';
import {PlayButton} from '@common/player/ui/controls/play-button';
import {RepeatButton} from '@common/player/ui/controls/repeat-button';
import {ShuffleButton} from '@common/player/ui/controls/shuffle-button';
import {
  ContinuousMixToggleButton,
  CrossfadeDurationButton,
} from '@common/player/ui/controls/continuous-mix-toggle';
import {cn} from '@ui/utils/cn';
import {useIsMobileMediaQuery} from '@ui/utils/hooks/is-mobile-media-query';

interface Props {
  className?: string;
}
export function PlaybackControls({className}: Props) {
  // Same component serves the desktop bar and the expanded overlay, so the
  // ad's restrictions land on both surfaces at once.
  const ad = useCuedAd();

  return (
    <div className={className}>
      <PlaybackButtons />
      <MainSeekbar disabled={!!ad} />
    </div>
  );
}

function PlaybackButtons() {
  const isMobile = useIsMobileMediaQuery();

  // need to add a gap on mobile between buttons and seekbar, otherwise seekbar will be impossible to tap
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-xs',
        isMobile && 'mb-5',
      )}
    >
      <ContinuousMixToggleButton />
      <CrossfadeDurationButton />
      <ShuffleButton className="hover:scale-105 active:scale-95 keekii-interactive" />
      <AdPreviousButton iconClassName="size-6" className="hover:scale-105 active:scale-95 keekii-interactive" />
      <div className="relative flex items-center justify-center">
        <BufferingIndicator />
        <PlayButton className="size-10.5 text-[var(--be-brand-ink)] hover:scale-105 active:scale-95 keekii-interactive" iconClassName="size-10" />
      </div>
      <AdNextButton iconClassName="size-6" className="hover:scale-105 active:scale-95 keekii-interactive" />
      <RepeatButton className="hover:scale-105 active:scale-95 keekii-interactive" />
    </div>
  );
}
