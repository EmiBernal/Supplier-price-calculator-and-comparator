import React, { useState } from 'react';
import HomeScreen from './HomeScreen';
import ManualEntryScreen from './ManualEntryScreen';
import CompareScreen from './CompareScreen';
import MainEquivalences from './MainEquivalences';
import UnmatchedEquivalencesScreen from './UnmatchedEquivalencesScreen';
import ActiveSuppliersScreen from './ActiveSuppliersScreen';

const SCREENS = {
  home: HomeScreen,
  manual: ManualEntryScreen,
  compare: CompareScreen,
  equivalences: MainEquivalences,
  unmatched: UnmatchedEquivalencesScreen,
  providers: ActiveSuppliersScreen,
} as const;

type ScreenKey = keyof typeof SCREENS;

interface Props { onLogout?: () => void }

export default function CalculadoraVentaScreen({ onLogout }: Props) {
  const [screen, setScreen] = useState<ScreenKey>('home');

  const onNavigate = (s: ScreenKey | string) => {
    if (s in SCREENS) setScreen(s as ScreenKey);
  };

  const Current = SCREENS[screen];
  const isHome = Current === HomeScreen;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* SIN padding externo para mantener el mismo layout que Compra */}
      <main>
        <Current
          onNavigate={onNavigate as any}
          {...(isHome ? { userRole: 'venta', onLogout } : { onLogout })}
        />
      </main>
    </div>
  );
}
