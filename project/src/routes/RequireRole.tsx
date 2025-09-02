import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth"; // debe exponer { role, isLoggedIn }

type Props = { allow: "venta" | "compra"; children: React.ReactNode };

export default function RequireRole({ allow, children }: Props) {
  const { role, isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (role !== allow) return <Navigate to={`/${role}`} replace />; // redirige a su “home”
  return <>{children}</>;
}
