import React, { useState } from 'react';
import { EquivalencesScreen } from './EquivalencesScreen';
import { UnmatchedEquivalencesScreen } from './UnmatchedEquivalencesScreen';
import { Screen } from '../types';

interface MainEquivalencesProps {
  onNavigate: (screen: Screen) => void;
}

export const MainEquivalences: React.FC<MainEquivalencesProps> = ({ onNavigate }) => {
  const [screen, setScreen] = useState<'related' | 'unmatched'>('related');

  return (
    <div className="p-6">
      {/* Botones como pestañas modernas */}
      <div className="flex justify-center mb-8 space-x-4">
        <button
          onClick={() => setScreen('related')}
          className={`px-6 py-3 text-lg font-semibold rounded-xl shadow transition-all duration-200 ${
            screen === 'related'
              ? 'bg-blue-600 text-white scale-105'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          Relacionados
        </button>
        <button
          onClick={() => setScreen('unmatched')}
          className={`px-6 py-3 text-lg font-semibold rounded-xl shadow transition-all duration-200 ${
            screen === 'unmatched'
              ? 'bg-blue-600 text-white scale-105'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          No relacionados
        </button>
      </div>

      {/* Pantallas */}
      {screen === 'related' && <EquivalencesScreen onNavigate={onNavigate} />}
      {screen === 'unmatched' && <UnmatchedEquivalencesScreen onNavigate={onNavigate} />}
    </div>
  );
};
