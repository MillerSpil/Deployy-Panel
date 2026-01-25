import React from 'react';
import { Header } from './Header';
import { UpdateBanner } from '@/components/update/UpdateBanner';
import { UpdateProgressModal } from '@/components/update/UpdateProgressModal';
import { useUpdate } from '@/contexts/UpdateContext';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentVersion } = useUpdate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <UpdateBanner />
      <Header />
      <main className="container mx-auto px-4 py-8 flex-1">{children}</main>
      <footer className="bg-slate-800 border-t border-slate-700 py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center text-sm text-slate-400">
            <span>Deployy Panel</span>
            <span>{currentVersion ? `v${currentVersion}` : ''}</span>
          </div>
        </div>
      </footer>
      <UpdateProgressModal />
    </div>
  );
}
