'use client';
// src/app/admin/map/page.tsx — 管理員校車即時地圖
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// 動態載入地圖（SSR 關閉）
const AdminMapView = dynamic(() => import('./AdminMapView'), { ssr: false });

export default function AdminMapPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') router.push('/login');
  }, [router]);

  return <AdminMapView />;
}
