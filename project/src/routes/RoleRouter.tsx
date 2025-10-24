// src/routes/RoleRouter.tsx
import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";

// VENTA
import VentaHome from "../screens/venta/HomeScreen";
import VentaCompare from "../screens/venta/CompareScreen";
import VentaManual from "../screens/venta/ManualEntryScreen";
import VentaMainEq from "../screens/venta/MainEquivalences";
import VentaUnmatched from "../screens/venta/UnmatchedEquivalencesScreen";
import VentaActiveSuppliers from "../screens/venta/ActiveSuppliersScreen";

// COMPRA (por ahora alias a venta)
import CompraHome from "../screens/compra/HomeScreen";
import CompraCompare from "../screens/compra/CompareScreen";
import CompraManual from "../screens/compra/ManualEntryScreen";
import CompraMainEq from "../screens/compra/MainEquivalences";
import CompraUnmatched from "../screens/compra/UnmatchedEquivalencesScreen";
import CompraActiveSuppliers from "../screens/venta/ActiveSuppliersScreen";

// Si ya tenés este tipo en otro archivo, podés importarlo.
// Lo defino acá para que compile sin depender de otros imports.
type Screen = "home" | "compare" | "manual" | "equivalences" | "unmatched" | "providers";

function pathFor(base: "/venta" | "/compra", screen: Screen) {
  switch (screen) {
    case "home":          return `${base}`;
    case "compare":       return `${base}/compare`;
    case "manual":        return `${base}/manual`;
    case "equivalences":  return `${base}/equivalences`;
    case "unmatched":     return `${base}/unmatched`;
    case "providers":     return `${base}/providers`;
  }
}

export default function RoleRouter() {
  const navigate = useNavigate();

  const goVenta = (s: Screen) => navigate(pathFor("/venta", s));
  const goCompra = (s: Screen) => navigate(pathFor("/compra", s));

  return (
    <Routes>
      {/* Home por defecto */}
      <Route path="/" element={<Navigate to="/venta" replace />} />

      {/* VENTA */}
      <Route
        path="/venta"
        element={
          <RequireRole allow="venta">
            <VentaHome onNavigate={goVenta} />
          </RequireRole>
        }
      />
      <Route
        path="/venta/compare"
        element={
          <RequireRole allow="venta">
            <VentaCompare onNavigate={goVenta} />
          </RequireRole>
        }
      />
      <Route
        path="/venta/manual"
        element={
          <RequireRole allow="venta">
            <VentaManual onNavigate={goVenta} />
          </RequireRole>
        }
      />
      <Route
        path="/venta/equivalences"
        element={
          <RequireRole allow="venta">
            <VentaMainEq onNavigate={goVenta} />
          </RequireRole>
        }
      />
      <Route
        path="/venta/unmatched"
        element={
          <RequireRole allow="venta">
            <VentaUnmatched onNavigate={goVenta} />
          </RequireRole>
        }
      />
      <Route
        path="/venta/providers"
        element={
          <RequireRole allow="venta">
            <VentaActiveSuppliers onNavigate={goVenta} />
          </RequireRole>
        }
      />

      {/* COMPRA */}
      <Route
        path="/compra"
        element={
          <RequireRole allow="compra">
            <CompraHome onNavigate={goCompra} />
          </RequireRole>
        }
      />
      <Route
        path="/compra/compare"
        element={
          <RequireRole allow="compra">
            <CompraCompare onNavigate={goCompra} />
          </RequireRole>
        }
      />
      <Route
        path="/compra/manual"
        element={
          <RequireRole allow="compra">
            <CompraManual onNavigate={goCompra} />
          </RequireRole>
        }
      />
      <Route
        path="/compra/equivalences"
        element={
          <RequireRole allow="compra">
            <CompraMainEq onNavigate={goCompra} />
          </RequireRole>
        }
      />
      <Route
        path="/compra/unmatched"
        element={
          <RequireRole allow="compra">
            <CompraUnmatched onNavigate={goCompra} />
          </RequireRole>
        }
      />
      <Route
        path="/compra/providers"
        element={
          <RequireRole allow="compra">
            <CompraActiveSuppliers onNavigate={goCompra} />
          </RequireRole>
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/venta" replace />} />
    </Routes>
  );
}
