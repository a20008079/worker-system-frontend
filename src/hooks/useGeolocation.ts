// src/hooks/useGeolocation.ts
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { updateLocation } from '@/lib/api';

interface Position { lat: number; lng: number; accuracy?: number }

export function useGeolocation(workerId: number | null, active: boolean, intervalMs = 2 * 60 * 1000) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getAndSend = useCallback(() => {
    if (!workerId) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition({ lat: latitude, lng: longitude, accuracy });
        try {
          await updateLocation({ worker_id: workerId, latitude, longitude, accuracy });
        } catch (e) {
          console.error('定位回傳失敗', e);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [workerId]);

  useEffect(() => {
    if (!active || !workerId) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    getAndSend(); // 立即執行一次
    intervalRef.current = setInterval(getAndSend, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, workerId, getAndSend, intervalMs]);

  return { position, error };
}
