import {useAdSkipSecondsLeft} from '@app/web-player/ads/use-ad-skip';
import {useCuedAd} from '@app/web-player/ads/use-cued-ad';
import {message} from '@ui/i18n/message';
import {Trans} from '@ui/i18n/trans';
import {useTrans} from '@ui/i18n/use-trans';
import {cn} from '@ui/utils/cn';
import {MegaphoneIcon} from 'lucide-react';

interface Props {
  className?: string;
  // Sized by the caller rather than by the block, because the desktop bar
  // art is 14 units square and the mobile bar art is 9.
  imageClassName?: string;
}

/**
 * Now-playing block for the mini bars and the expanded overlay, in the same
 * slot a queued track would occupy. Carries the ad's only disclosures: the
 * "Ad" pill, the advertiser, and either the countdown to the skip moment or
 * the plain statement that there is none - so a sighted listener never has to
 * guess why next/previous stopped working.
 *
 * Renders nothing when a real track is cued, which is why the surfaces can
 * leave their own track markup in place and simply branch on this.
 */
export function AdNowPlaying({
  className,
  imageClassName = 'size-14',
}: Props) {
  const ad = useCuedAd();
  const secondsLeft = useAdSkipSecondsLeft(ad);
  const {trans} = useTrans();

  if (!ad) return null;

  const hasImage = !!ad.image_path;
  const isCountingDown = secondsLeft != null && secondsLeft > 0;
  const statusMessage = isCountingDown
    ? trans(message('Skip in :seconds', {values: {seconds: secondsLeft}}))
    : secondsLeft === 0
      ? trans(message('Skip ad'))
      : trans(message('Advertisement'));

  return (
    <div className={cn('group flex min-w-0 items-center gap-sm', className)}>
      {hasImage ? (
        <img
          className={cn(
            'shrink-0 rounded object-cover shadow-sm',
            imageClassName,
          )}
          draggable={false}
          src={ad.image_path!}
          alt={trans(
            message('Image for :name', {values: {name: ad.name}}),
          )}
        />
      ) : (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded bg-foreground/5',
            imageClassName,
          )}
          aria-hidden="true"
        >
          <MegaphoneIcon className="size-6 text-border" />
        </div>
      )}
      <div className="min-w-0 overflow-hidden flex flex-col justify-center">
        <div className="flex min-w-0 items-center gap-xs">
          <span className="keekii-ambient-caption shrink-0 rounded bg-warning px-1 py-px text-[10px] font-bold uppercase leading-tight text-white">
            <Trans message="Ad" />
          </span>
          <span className="truncate text-be-body font-bold text-foreground">
            {ad.name}
          </span>
        </div>
        {ad.advertiser_name ? (
          <div className="keekii-ambient-caption truncate text-be-caption font-medium text-foreground">
            {ad.advertiser_name}
          </div>
        ) : null}
        <div className="keekii-ambient-caption mt-0.5 truncate text-be-caption font-medium">
          {statusMessage}
        </div>
        {/* The visible line ticks once a second, which would make a live
            region chatter; this one stays empty until the ad becomes
            skippable and speaks exactly once. */}
        <span className="sr-only" aria-live="polite">
          {secondsLeft === 0 ? trans(message('Skip ad')) : ''}
        </span>
      </div>
    </div>
  );
}
