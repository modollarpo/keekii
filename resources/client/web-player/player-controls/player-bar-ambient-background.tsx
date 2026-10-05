import {useCuedTrack} from '@app/web-player/player-controls/use-cued-track';
import clsx from 'clsx';
import {useState, useEffect} from 'react';

export function PlayerBarAmbientBackground() {
  const track = useCuedTrack();
  const [imageLoaded, setImageLoaded] = useState(false);
  const image = track?.image;

  useEffect(() => {
    setImageLoaded(false);
  }, [image]);

  if (!image) {
    return <div className="pointer-events-none absolute inset-0 -z-10 bg-card" />;
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img
        src={image}
        alt=""
        className={clsx(
          'absolute inset-0 h-full w-full object-cover blur-ambient scale-150',
          imageLoaded ? 'opacity-100' : 'opacity-0',
          // The fade exists to hide the cover popping in. Under reduced motion
          // there is nothing decorative about it, so it snaps instead.
          'transition-opacity duration-700 ease-in-out motion-reduce:transition-none',
        )}
        onLoad={() => setImageLoaded(true)}
      />
      <div className="absolute inset-0 bg-background/85" />
    </div>
  );
}
