import {useAdSkipSecondsLeft, useSkipAd} from '@app/web-player/ads/use-ad-skip';
import {useCuedAd} from '@app/web-player/ads/use-cued-ad';
import {NextButton} from '@common/player/ui/controls/next-button';
import {PreviousButton} from '@common/player/ui/controls/previous-button';
import {Button} from '@shadcn/button/button';
import {Tooltip} from '@shadcn/tooltip/tooltip';
import {MediaNextIcon} from '@ui/icons/media/media-next';
import {MediaPreviousIcon} from '@ui/icons/media/media-previous';
import {MediaSeekForwardIcon} from '@ui/icons/media/media-seek-forward';
import {message} from '@ui/i18n/message';
import {Trans} from '@ui/i18n/trans';
import {useTrans} from '@ui/i18n/use-trans';
import {cn} from '@ui/utils/cn';
import {ReactNode} from 'react';

interface Props {
  className?: string;
  iconClassName?: string;
  stopPropagation?: boolean;
}

/**
 * Next/previous replacements used in the same slots as the real buttons.
 * While an ad owns the surface they are inert (previous outright, next until
 * the configured skip moment), and the moment it does not they are simply the
 * real buttons again - so a listener who never sees an ad sees no difference.
 */
export function AdPreviousButton({
  className,
  iconClassName,
  stopPropagation,
}: Props) {
  const ad = useCuedAd();
  const {trans} = useTrans();

  if (!ad) {
    return (
      <PreviousButton
        className={className}
        iconClassName={iconClassName}
        stopPropagation={stopPropagation}
      />
    );
  }

  return (
    <InertIconButton
      className={className}
      stopPropagation={stopPropagation}
      icon={<MediaPreviousIcon className={cn('size-6', iconClassName)} />}
      label={trans(message('Previous is unavailable during ads'))}
    />
  );
}

export function AdNextButton({
  className,
  iconClassName,
  stopPropagation,
}: Props) {
  const ad = useCuedAd();
  const secondsLeft = useAdSkipSecondsLeft(ad);
  const skipAd = useSkipAd();
  const {trans} = useTrans();

  if (!ad) {
    return (
      <NextButton
        className={className}
        iconClassName={iconClassName}
        stopPropagation={stopPropagation}
      />
    );
  }

  if (secondsLeft == null) {
    return (
      <InertIconButton
        className={className}
        stopPropagation={stopPropagation}
        icon={<MediaNextIcon className={cn('size-6', iconClassName)} />}
        label={trans(message("This ad can't be skipped"))}
      />
    );
  }

  if (secondsLeft > 0) {
    return (
      <InertIconButton
        className={className}
        stopPropagation={stopPropagation}
        icon={<MediaNextIcon className={cn('size-6', iconClassName)} />}
        label={trans(
          message('Skip ad in :seconds', {values: {seconds: secondsLeft}}),
        )}
      />
    );
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={className}
            aria-label={trans(message('Skip ad'))}
            onClick={e => {
              if (stopPropagation) {
                e.stopPropagation();
              }
              skipAd();
            }}
          />
        }
      >
        <MediaSeekForwardIcon className={cn('size-6', iconClassName)} />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <Trans message="Skip ad" />
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

interface InertIconButtonProps {
  icon: ReactNode;
  label: string;
  className?: string;
  stopPropagation?: boolean;
}

/**
 * `focusableWhenDisabled` is load bearing: a natively disabled button cannot
 * be reached by keyboard, so a screen-reader or keyboard listener would never
 * learn *why* the control is off. Keeping it focusable lets Base UI mark it
 * `aria-disabled` instead, so focusing it announces the reason carried in the
 * label, and the tooltip still opens on hover/focus for everyone else.
 */
function InertIconButton({
  icon,
  label,
  className,
  stopPropagation,
}: InertIconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            disabled
            focusableWhenDisabled
            variant="ghost"
            size="icon"
            className={className}
            aria-label={label}
            onClick={e => {
              if (stopPropagation) {
                e.stopPropagation();
              }
            }}
          />
        }
      >
        {icon}
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}
