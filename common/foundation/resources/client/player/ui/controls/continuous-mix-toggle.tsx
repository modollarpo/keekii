import { useState, useCallback } from 'react';
import { Button } from '@shadcn/button/button';
import { Trans } from '@ui/i18n/trans';

export function useContinuousMixMode() {
  const [isContinuousMixEnabled, setIsContinuousMixEnabled] = useState(false);
  const [crossfadeDuration, setCrossfadeDuration] = useState(5); // Default 5s per user choice

  const toggleContinuousMix = useCallback(() => {
    setIsContinuousMixEnabled(prev => !prev);
  }, []);

  return {
    isContinuousMixEnabled,
    toggleContinuousMix,
    crossfadeDuration,
    setCrossfadeDuration,
  };
}

export function ContinuousMixToggleButton({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={enabled ? 'default' : 'outline'}
      color={enabled ? 'primary' : 'neutral'}
      size="xs"
      onClick={onToggle}
      title="Toggle Continuous DJ Mix Crossfade Mode"
    >
      <Trans message={enabled ? 'DJ Mix: On' : 'DJ Mix: Off'} />
    </Button>
  );
}
