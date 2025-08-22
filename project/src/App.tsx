import { useEffect, useLayoutEffect, useState } from 'react';
import { Screen } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { ManualEntryScreen } from './screens/ManualEntryScreen'; // usa named import si tu archivo exporta named
import { CompareScreen } from './screens/CompareScreen';
import { MainEquivalences } from './screens/MainEquivalences'; // idem
import { Sun, Moon } from 'lucide-react';

function getInitialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  if (document.documentElement.classList.contains('dark')) return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());

  // Aplica la clase dark/light ANTES del primer repintado para evitar “flash”
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Persiste y mantiene sincronizado (por si abrís otra pestaña)
  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const v = e.newValue === 'dark' ? 'dark' : 'light';
        setTheme(v);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/health');
        if (!res.ok) throw new Error();
      } catch {}
      setIsInitialized(true);
    };
    init();
  }, []);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));
  const handleNavigate = (screen: Screen) => setCurrentScreen(screen);

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
    // ⚠️ Importante: el wrapper de App NO debe sobreescribir el fondo de Home
    <div className={["min-h-screen transition-colors",
      currentScreen !== 'home' ? "bg-gray-50 dark:bg-gray-900" : "bg-transparent"
    ].join(' ')}>
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 z-50"
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
