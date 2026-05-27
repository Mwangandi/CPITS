import { useEffect } from 'react';

const CACHE_CLEAR_INTERVAL = 30 * 60 * 1000; // 30 minutes

export const useCacheCleanup = (onCleared?: () => void) => {
  useEffect(() => {
    const clearCache = () => {
      try {
        // Clear localStorage
        localStorage.clear();
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        console.log('[Cache Cleanup] Cleared localStorage and sessionStorage');
        
        // Trigger callback (e.g., to show toast notification)
        if (onCleared) {
          onCleared();
        }
      } catch (error) {
        console.error('[Cache Cleanup] Error clearing cache:', error);
      }
    };

    // Set interval to clear cache every 5 minutes
    const intervalId = setInterval(clearCache, CACHE_CLEAR_INTERVAL);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [onCleared]);
};
