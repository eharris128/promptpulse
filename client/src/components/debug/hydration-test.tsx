"use client";

import { useState, useEffect } from 'react';
import { debugLogger } from '@/utils/debug-logger';

export function HydrationTest() {
  const [mounted, setMounted] = useState(false);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [serverTime] = useState(() => Date.now());
  const [clientTime, setClientTime] = useState<number | null>(null);

  useEffect(() => {
    debugLogger.log('HydrationTest', 'Component mounting', {
      serverTime,
      timestamp: performance.now()
    });
    
    setMounted(true);
    setClientTime(Date.now());
    
    // Check if hydration completed successfully
    const checkHydration = () => {
      setHydrationComplete(true);
      debugLogger.log('HydrationTest', 'Hydration test complete', {
        serverTime,
        clientTime: Date.now(),
        timeDiff: Date.now() - serverTime,
        timestamp: performance.now()
      });
    };
    
    setTimeout(checkHydration, 100);
  }, [serverTime]);

  // This component helps test for hydration mismatches
  const isRailway = typeof window !== 'undefined' && 
    (window.location.hostname.includes('railway.app') || 
     window.location.hostname.includes('promptpulse.dev'));

  if (!isRailway) return null;

  return (
    <div className="fixed top-16 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs z-40">
      Hydration: {mounted ? (hydrationComplete ? '✅' : '⏳') : '❌'}
      {clientTime && (
        <div className="text-xs">
          Δ{clientTime - serverTime}ms
        </div>
      )}
    </div>
  );
}