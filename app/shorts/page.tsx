'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Loader } from '@/components/ui';

export default function ShortsIndex() {
  const router = useRouter();
  useEffect(() => {
    api({ fn: 'search', q: '#shorts', type: 'shorts', sort: 'relevance' }).then((d) => {
      const s = d.items.find((x: any) => x.kind === 'short');
      if (s) router.replace(`/shorts/${s.id}`);
    }).catch(() => {});
  }, [router]);
  return <Loader />;
}
