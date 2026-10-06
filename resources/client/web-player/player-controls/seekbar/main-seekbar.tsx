import {FormattedCurrentTime} from '@common/player/ui/controls/formatted-current-time';
import {FormattedPlayerDuration} from '@common/player/ui/controls/formatted-player-duration';
import {Seekbar} from '@common/player/ui/controls/seeking/seekbar';
import {Fragment} from 'react';

interface Props {
  // Passed through to the seekbar so callers can freeze it (the pre-roll
  // forbids seeking) while the bar itself stays on screen and keeps showing
  // where the creative actually is.
  disabled?: boolean;
}

export function MainSeekbar({disabled}: Props) {
  return (
    <Fragment>
      <div className="flex items-center gap-sm">
        {/* Both labels sit on the blurred artwork. muted-foreground measures
            3.54:1 / 3.36:1 there and the brand ink 3.33:1, so neither clears
            AA at 12px; keekii-ambient-caption does. The playing time used to
            be set apart by being orange, which is a colour-only distinction
            anyway -- weight carries it now. */}
        <div className="keekii-ambient-caption font-medium min-w-10 shrink-0 text-right text-xs">
          <FormattedCurrentTime />
        </div>
        <Seekbar
          className="flex-auto"
          trackClassName="bg-secondary"
          disabled={disabled}
        />
        <div className="keekii-ambient-caption min-w-10 shrink-0 text-right text-xs">
          <FormattedPlayerDuration />
        </div>
      </div>
    </Fragment>
  );
}
