import { useState, useEffect } from 'react';
import { Screen } from './types'; // Ajustá la ruta según tu estructura
import { HomeScreen } from './screens/HomeScreen';
import { ManualEntryScreen } from './screens/ManualEntryScreen';
import { CompareScreen } from './screens/CompareScreen';
import { MainEquivalences } from './screens/mainEquivalences'; // Importá MainEquivalences
import { Sun, Moon } from 'lucide-react';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/health');
        if (!response.ok) throw new Error('Backend no responde OK');
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize backend:', error);
        setIsInitialized(true); // continuar igual aunque falle backend
      }
    };

    initializeApp();
  }, []);

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Initializing Gampack Price Comparator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>
      {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate} />}
      {currentScreen === 'manual' && <ManualEntryScreen onNavigate={handleNavigate} />}
      {currentScreen === 'equivalences' && <MainEquivalences onNavigate={handleNavigate} />}
      {currentScreen === 'compare' && <CompareScreen onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
