// src/hooks/useGoogleMap.ts
'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  version: 'weekly',
  libraries: ['maps', 'marker'],
});

export function useGoogleMap(containerRef: React.RefObject<HTMLDivElement>, center: google.maps.LatLngLiteral) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    loader.load().then(() => {
      if (mapRef.current) return; // 避免重複初始化
      mapRef.current = new google.maps.Map(containerRef.current!, {
        center,
        zoom: 13,
        mapId: 'worker_map',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      });
      setReady(true);
    });
  }, []);

  return { map: mapRef.current, ready };
}
