'use client';

import { useEffect, useCallback } from 'react';

type HistoryState = {
  view?: string;
  venueId?: string | null;
};

export function useBrowserHistorySync({
  activeView,
  setActiveView,
  selectedVenueId,
  onRestoreVenueById,
}: {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedVenueId: string | null;
  onRestoreVenueById: (venueId: string | null) => void;
}) {
  // Push a new history entry whenever the view or open venue modal changes
  const navigateTo = useCallback(
    (nextView: string, nextVenueId: string | null = null) => {
      const params = new URLSearchParams(window.location.search);

      if (nextView && nextView !== 'home') {
        params.set('view', nextView);
      } else {
        params.delete('view');
      }

      if (nextVenueId) {
        params.set('venue', nextVenueId);
      } else {
        params.delete('venue');
      }

      const queryString = params.toString();
      const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;

      window.history.pushState(
        { view: nextView, venueId: nextVenueId } satisfies HistoryState,
        '',
        newUrl
      );

      setActiveView(nextView);
      onRestoreVenueById(nextVenueId);
    },
    [setActiveView, onRestoreVenueById]
  );

  // Listen to Chrome Back / Forward button presses
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as HistoryState | null;
      const params = new URLSearchParams(window.location.search);

      const restoredView = state?.view || params.get('view') || 'home';
      const restoredVenueId =
        state?.venueId !== undefined ? state.venueId : params.get('venue');

      setActiveView(restoredView);
      onRestoreVenueById(restoredVenueId || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveView, onRestoreVenueById]);

  return { navigateTo };
}