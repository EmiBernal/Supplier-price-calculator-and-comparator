import React, { useState, useEffect } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ManualEntryScreen } from './screens/ManualEntryScreen';
import { EquivalencesScreen } from './screens/EquivalencesScreen';
import { CompareScreen } from './screens/CompareScreen';
import { Screen } from './types'

type Screen = 'home' | 'manual' | 'equivalences' | 'compare';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/health');
        if (!response.ok) throw new Error('Backend no responde OK');
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize backend:', error);
        setIsInitialized(true); // continuar igual
      }
    };

    initializeApp();
  }, []);

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing Gampack Price Comparator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate} />}
      {currentScreen === 'manual' && <ManualEntryScreen onNavigate={handleNavigate} />}
      {currentScreen === 'equivalences' && <EquivalencesScreen onNavigate={handleNavigate} />}
      {currentScreen === 'compare' && <CompareScreen onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
