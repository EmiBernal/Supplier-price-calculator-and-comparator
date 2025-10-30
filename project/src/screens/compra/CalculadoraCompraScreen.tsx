import React, { useState } from 'react';
import ThemeToggleButton from '../../components/ThemeToggleButton';
import HomeScreen from './HomeScreen'; // reexport de la Home con el toggle dark/light
import ManualEntryScreen from './ManualEntryScreen';
import CompareScreen from './CompareScreen';
import MainEquivalences from './MainEquivalences';
import UnmatchedEquivalencesScreen from './UnmatchedEquivalencesScreen';

const SCREENS = {
  home: HomeScreen,
  manual: ManualEntryScreen,
  compare: CompareScreen,
  equivalences: MainEquivalences,
  unmatched: UnmatchedEquivalencesScreen,
} as const;

type ScreenKey = keyof typeof SCREENS;

type Props = { onLogout?: () => void };

export default function CalculadoraCompraScreen({ onLogout }: Props) {
  const [screen, setScreen] = useState<ScreenKey>('home');

  const onNavigate = (s: ScreenKey | string) => {
    if (s in SCREENS) setScreen(s as ScreenKey);
  };

  const Current = SCREENS[screen];
  const isHome = Current === HomeScreen;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ThemeToggleButton className="fixed right-4 top-4 z-40" />
      {/* SIN padding externo para que coincida con Venta */}
      <main>
        <Current
          onNavigate={onNavigate as any}
          {...(isHome ? { userRole: 'compra', onLogout } : { onLogout })}
        />
      </main>
    </div>
  );
}
