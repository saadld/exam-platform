import { useEffect, useRef, useState } from 'react';

interface UseAntiCheatOptions {
  enabled: boolean;
  maxWarnings: number;
  onWarning: (count: number) => void;
  onMaxWarningsReached: () => void;
}

export function useAntiCheat({
  enabled,
  maxWarnings,
  onWarning,
  onMaxWarningsReached,
}: UseAntiCheatOptions) {
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const hasReachedMaxWarnings = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !hasReachedMaxWarnings.current) {
        const newCount = warningCount + 1;
        setWarningCount(newCount);
        setShowWarningModal(true);
        onWarning(newCount);

        if (newCount >= maxWarnings) {
          hasReachedMaxWarnings.current = true;
          onMaxWarningsReached();
        }
      }
    };

    const handleBlur = () => {
      if (!hasReachedMaxWarnings.current) {
        const newCount = warningCount + 1;
        setWarningCount(newCount);
        setShowWarningModal(true);
        onWarning(newCount);

        if (newCount >= maxWarnings) {
          hasReachedMaxWarnings.current = true;
          onMaxWarningsReached();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, warningCount, maxWarnings, onWarning, onMaxWarningsReached]);

  const closeWarningModal = () => {
    setShowWarningModal(false);
  };

  return {
    warningCount,
    showWarningModal,
    closeWarningModal,
  };
}
