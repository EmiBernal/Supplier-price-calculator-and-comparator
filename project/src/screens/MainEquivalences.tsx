import React, { useState } from 'react';
import { EquivalencesScreen } from './EquivalencesScreen';
import { UnmatchedEquivalencesScreen } from './UnmatchedEquivalencesScreen';
import { Screen } from '../types';
import { TitleHeader } from '../components/TitleHeader';

interface MainEquivalencesProps {
  onNavigate: (screen: Screen) => void;
}

export const MainEquivalences: React.FC<MainEquivalencesProps> = ({ onNavigate }) => {
  const [screen, setScreen] = useState<'related' | 'unmatched'>('related');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f1a] p-6">
      <div className="max-w-7xl mx-auto">
        <TitleHeader
          eyebrow="Gampack · Equivalencias"
          titleMain="Equivalencias"
          titleAfter="de productos"
          subtitle="Gestioná relaciones existentes o encontrá coincidencias pendientes."
          chips={[
            { label: screen === 'related' ? 'Vista' : 'Cambiar a', value: screen === 'related' ? 'Relacionados' : 'No relacionados' },
          ]}
          right={
            <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10">
              <button
                onClick={() => setScreen('related')}
                className={`px-4 py-2 text-sm md:text-base rounded-lg transition-all ${
                  screen === 'related'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-white/20'
                }`}
              >
                Relacionados
              </button>
              <button
                onClick={() => setScreen('unmatched')}
                className={`px-4 py-2 text-sm md:text-base rounded-lg transition-all ${
                  screen === 'unmatched'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-white/20'
                }`}
              >
                No relacionados
              </button>
            </div>
          }
        />

        {/* Pantallas */}
        {screen === 'related' && <EquivalencesScreen onNavigate={onNavigate} />}
        {screen === 'unmatched' && <UnmatchedEquivalencesScreen onNavigate={onNavigate} />}
      </div>
    </div>
  );
};
