'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const router = useRouter();
  useEffect(() => { router.replace('/parent/login'); }, [router]);
  return null;
}