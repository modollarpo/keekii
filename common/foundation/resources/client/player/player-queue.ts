import {MediaItem} from '@common/player/media-item';
import {PlayerState} from '@common/player/state/player-state';

export function playerQueue(state: () => PlayerState) {
  const getPointer = (): number => {
    if (state().cuedMedia) {
      return (
        state().shuffledQueue.findIndex(
          item => item.id === state().cuedMedia?.id
        ) || 0
      );
    }
    return 0;
  };
  const getCurrent = (): MediaItem | undefined => {
    return state().shuffledQueue[getPointer()];
  };
  const getFirst = (): MediaItem | undefined => {
    return state().shuffledQueue[0];
  };
  const getLast = (): MediaItem | undefined => {
    return state().shuffledQueue[state().shuffledQueue.length - 1];
  };
  const getNext = (): MediaItem | undefined => {
    return state().shuffledQueue[getPointer() + 1];
  };
  const getPrevious = (): MediaItem | undefined => {
    return state().shuffledQueue[getPointer() - 1];
  };
  const isLast = (): boolean => {
    return getPointer() === state().originalQueue.length - 1;
  };

  /**
   * The item playback would advance to on playbackEnd, without moving the
   * queue. Returns undefined when the normal ended-flow owns the advance
   * instead: repeat-one, the end of the queue (loadMoreMediaItems /
   * repeat-all wrap run there), or a next item this audio-only crossfade
   * provider cannot play.
   */
  const peekNext = (): MediaItem | undefined => {
    if (state().repeat === 'one') return undefined;
    const pointer = getPointer();
    // media that never joined the queue (e.g. an ad) has no successor here
    if (pointer < 0) return undefined;
    const next = state().shuffledQueue[pointer + 1];
    if (!next) return undefined;
    if (next.provider !== 'htmlAudio' || !next.src) return undefined;
    return next;
  };

  return {
    getPointer,
    getCurrent,
    getFirst,
    getLast,
    getNext,
    getPrevious,
    isLast,
    peekNext,
  };
}
