'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const ParentMapView = dynamic(() => import('./ParentMapView'), { ssr: false });

export default function ParentPage() {
  const router = useRouter();
  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'parent') router.push('/login');
  }, [router]);
  return <ParentMapView />;
}
