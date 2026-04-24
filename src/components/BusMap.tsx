'use client';
// src/components/BusMap.tsx — Leaflet 地圖（校車位置）
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface Props {
  latitude:  number;
  longitude: number;
  busName:   string;
  isOnline:  boolean;
}

export default function BusMap({ latitude, longitude, busName, isOnline }: Props) {
  const mapRef     = useRef<any>(null);
  const markerRef  = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // 已初始化

    import('leaflet').then((L) => {
      const map = L.map(containerRef.current!, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // 自訂校車圖示
      const busIcon = L.divIcon({
        html: `<div style="
          background: ${isOnline ? '#10b981' : '#6b7280'};
          color: white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          border: 2px solid white;
        ">
          <span style="transform: rotate(45deg); font-size: 18px;">🚌</span>
        </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const marker = L.marker([latitude, longitude], { icon: busIcon })
        .addTo(map)
        .bindPopup(`<b>${busName}</b><br>${isOnline ? '🟢 行駛中' : '🔴 未出發'}`);

      mapRef.current    = map;
      markerRef.current = marker;
    });
  }, []);

  // 更新位置
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
    mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '55vw' }}
    />
  );
}
