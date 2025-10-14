// src/App.tsx
import { useEffect, useLayoutEffect, useState } from "react";
import { Screen } from "./types";
import { Sun, Moon } from "lucide-react";
import { apiFetch } from "./lib/api";

// ✅ Importar pantallas de COMPRA
import HomeScreenCompra from "./screens/compra/HomeScreen";
import ManualEntryScreenCompra from "./screens/compra/ManualEntryScreen";
import CompareScreenCompra from "./screens/compra/CompareScreen";
import MainEquivalencesCompra from "./screens/compra/MainEquivalences";
import LoginScreenCompra from "./screens/compra/LoginScreen";
import CalculadoraCompraScreen from "./screens/compra/CalculadoraCompraScreen";

// ✅ Importar pantallas de VENTA
import HomeScreenVenta from "./screens/venta/HomeScreen";
import ManualEntryScreenVenta from "./screens/venta/ManualEntryScreen";
import CompareScreenVenta from "./screens/venta/CompareScreen";
import MainEquivalencesVenta from "./screens/venta/MainEquivalences";
import LoginScreenVenta from "./screens/venta/LoginScreen";
import CalculadoraVentaScreen from "./screens/venta/CalculadoraVentaScreen";
import ActiveSuppliersScreenVenta from "./screens/venta/ActiveSuppliersScreen";

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
  const [role, setRole] = useState<"compra" | "venta" | null>(() => {
    try {
      const r = localStorage.getItem("role");
      return r === "compra" || r === "venta" ? (r as "compra" | "venta") : null;
    } catch {
      return null;
    }
  });

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
        const res = await apiFetch("/api/health");
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

  // 🔑 Si no hay sesión -> mostrar login de cada rol
  if (!role) {
    // Podrías unificar con un selector inicial (ej: elegir Compra o Venta antes de login)
    return (
      <div>
        {/* Default: login de compra, podés cambiarlo */}
        <LoginScreenCompra onLoginSuccess={setRole} />
      </div>
    );
  }

  // 🔑 Si es compra -> mostrar flujo de COMPRA
  if (role === "compra") {
    return <CalculadoraCompraScreen onLogout={() => setRole(null)} />;
  }

  // 🔑 Si es venta -> mostrar flujo de VENTA
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

      {currentScreen === "home" && (
        <HomeScreenVenta onNavigate={handleNavigate} />
      )}
      {currentScreen === "manual" && (
        <ManualEntryScreenVenta onNavigate={handleNavigate} />
      )}
      {currentScreen === "equivalences" && (
        <MainEquivalencesVenta onNavigate={handleNavigate} />
      )}
      {currentScreen === "compare" && (
        <CompareScreenVenta onNavigate={handleNavigate} />
      )}
      {currentScreen === "providers" && (
        <ActiveSuppliersScreenVenta onNavigate={handleNavigate} />
      )}
    </div>
  );
}

export default App;
