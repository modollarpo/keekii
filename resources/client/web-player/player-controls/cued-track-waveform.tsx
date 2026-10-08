import {useCuedAd} from '@app/web-player/ads/use-cued-ad';
import {useCuedTrack} from '@app/web-player/player-controls/use-cued-track';
import {useTrackWaveData} from '@app/web-player/tracks/requests/use-track-wave-data';
import {trackIsLocallyUploaded} from '@app/web-player/tracks/utils/track-is-locally-uploaded';
import {drawWaveform} from '@app/web-player/tracks/waveform/draw-waveform';
import {
  WAVE_HEIGHT,
  WAVE_WIDTH,
} from '@app/web-player/tracks/waveform/generate-waveform-data';
import {usePlayerActions} from '@common/player/hooks/use-player-actions';
import {usePlayerStore} from '@common/player/hooks/use-player-store';
import {useSettings} from '@ui/settings/use-settings';
import {getCurrentThemeValue} from '@ui/themes/utils/get-current-theme-value';
import {cn} from '@ui/utils/cn';
import {useEffect, useRef, useState} from 'react';

interface Props {
  className?: string;
}

// Non-interactive waveform visual for the expanded player, fed by the
// pre-generated peak file the analysis job writes at ingest. It only shows
// where playback is: the seekbar underneath stays the accessible control,
// and the admin's seekbar_type setting decides whether this renders at all.
export function CuedTrackWaveform({className}: Props) {
  const ad = useCuedAd();
  const track = useCuedTrack();
  const {player} = useSettings();
  const shouldShow =
    !!track &&
    !ad &&
    player?.seekbar_type === 'waveform' &&
    trackIsLocallyUploaded(track);

  const {data} = useTrackWaveData(track?.id ?? -1, {enabled: shouldShow});
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const waveData = data?.waveData;
    if (!waveData?.length) return;
    if (baseCanvasRef.current) {
      drawWaveform(waveData, baseCanvasRef.current, '#666');
    }
    if (progressCanvasRef.current) {
      drawWaveform(
        waveData,
        progressCanvasRef.current,
        getCurrentThemeValue('--be-primary'),
      );
    }
  }, [data]);

  const actions = usePlayerActions();
  const cuedMedia = usePlayerStore(s => s.cuedMedia);
  const mediaDuration = usePlayerStore(s => s.mediaDuration);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    return actions.subscribe({
      progress: ({currentTime}) => setCurrentTime(currentTime),
    });
  }, [actions]);

  if (!shouldShow || !data?.waveData?.length) return null;

  const progress =
    track && cuedMedia?.id === track.id && mediaDuration
      ? Math.min(1, Math.max(0, currentTime / mediaDuration))
      : 0;

  return (
    <div className={cn('relative w-full', className)} aria-hidden="true">
      <canvas
        ref={baseCanvasRef}
        width={WAVE_WIDTH}
        height={WAVE_HEIGHT + 25}
        className="block h-auto w-full"
      />
      <canvas
        ref={progressCanvasRef}
        width={WAVE_WIDTH}
        height={WAVE_HEIGHT + 25}
        className="absolute inset-0 h-full w-full"
        style={{clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`}}
      />
    </div>
  );
}
