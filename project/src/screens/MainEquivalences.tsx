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
    <div>
      <div className="mb-4">
        <button
          onClick={() => setScreen('related')}
          className={`mr-2 px-4 py-2 rounded ${screen === 'related' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Relacionados
        </button>
        <button
          onClick={() => setScreen('unmatched')}
          className={`px-4 py-2 rounded ${screen === 'unmatched' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          No relacionados
        </button>
      </div>

      {screen === 'related' && <EquivalencesScreen onNavigate={onNavigate} />}
      {screen === 'unmatched' && <UnmatchedEquivalencesScreen onNavigate={onNavigate} />}
    </div>
  );
};
