'use client';
import { use } from 'react';
import { Profile } from '@/components/profile';
import { TabBar } from '@/components/ui';
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <><Profile id={id} /><TabBar /></>; }
