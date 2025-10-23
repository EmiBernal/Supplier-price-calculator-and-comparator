import React, { createContext, useContext, useState, useEffect } from "react";

type Role = "compra" | "venta";
type AuthCtx = { isLoggedIn: boolean; role: Role | null; setAuth: (r: Role) => void; logout: () => void };

const Ctx = createContext<AuthCtx>({ isLoggedIn: false, role: null, setAuth: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(() => {
    try {
      const stored = localStorage.getItem("role");
      return stored === "venta" || stored === "compra" ? stored : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "role") return;
      const value = event.newValue;
      setRole(value === "venta" || value === "compra" ? (value as Role) : null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setAuth = (r: Role) => {
    setRole(r);
    try {
      localStorage.setItem("role", r);
    } catch {}
  };
  const logout = () => {
    setRole(null);
    try {
      localStorage.removeItem("role");
    } catch {}
  };

  return (
    <Ctx.Provider value={{ isLoggedIn: !!role, role, setAuth, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
