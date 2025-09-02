import React, { createContext, useContext, useState, useEffect } from "react";

type Role = "compra" | "venta";
type AuthCtx = { isLoggedIn: boolean; role: Role | null; setAuth: (r: Role) => void; logout: () => void };

const Ctx = createContext<AuthCtx>({ isLoggedIn: false, role: null, setAuth: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const r = localStorage.getItem("role") as Role | null;
    if (r === "venta" || r === "compra") setRole(r);
  }, []);

  const setAuth = (r: Role) => {
    setRole(r);
    localStorage.setItem("role", r);
  };
  const logout = () => {
    setRole(null);
    localStorage.removeItem("role");
  };

  return (
    <Ctx.Provider value={{ isLoggedIn: !!role, role, setAuth, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
