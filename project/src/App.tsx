// src/App.tsx
import { useEffect, useLayoutEffect, useState } from "react";
import { Screen } from "./types";

// ✅ imports como default (sin llaves)
import HomeScreen from "./screens/compra/HomeScreen";
import ManualEntryScreen from "./screens/compra/ManualEntryScreen";
import CompareScreen from "./screens/compra/CompareScreen";
import MainEquivalences from "./screens/compra/MainEquivalences";

import { Sun, Moon } from "lucide-react";

// ✅ Login exporta default
import LoginScreen from "./screens/compra/LoginScreen";

// ✅ Calculadora para COMPRA (alias a venta por ahora)
import CalculadoraCompraScreen from "./screens/compra/CalculadoraCompraScreen";

function getInitialTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  if (document.documentElement.classList.contains("dark")) return "dark";
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [isInitialized, setIsInitialized] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [role, setRole] = useState<"compra" | "venta" | null>(null);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        const v = e.newValue === "dark" ? "dark" : "light";
        setTheme(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:4000/api/health");
        if (!res.ok) throw new Error();
      } catch {}
      setIsInitialized(true);
    })();
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const handleNavigate = (screen: Screen) => setCurrentScreen(screen);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Initializing Gampack Price Comparator...
          </p>
        </div>
      </div>
    );
  }

  // 🔑 Si no hay sesión -> mostrar login
  if (!role) {
    return <LoginScreen onLoginSuccess={setRole} />;
  }

  // 🔑 Si es compra -> mostrar calculadora especial
  if (role === "compra") {
    return <CalculadoraCompraScreen onLogout={() => setRole(null)} />;
  }

  // 🔑 Si es venta -> flujo normal
  return (
    <div
      className={[
        "min-h-screen transition-colors",
        currentScreen !== "home"
          ? "bg-gray-50 dark:bg-gray-900"
          : "bg-transparent",
      ].join(" ")}
    >
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 z-50"
        aria-label="Toggle theme"
      >
        {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      {currentScreen === "home" && <HomeScreen onNavigate={handleNavigate} />}
      {currentScreen === "manual" && (
        <ManualEntryScreen onNavigate={handleNavigate} />
      )}
      {currentScreen === "equivalences" && (
        <MainEquivalences onNavigate={handleNavigate} />
      )}
      {currentScreen === "compare" && (
        <CompareScreen onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default App;
