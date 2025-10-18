import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminPayments from "./pages/AdminPayments";

import App from "./App.tsx";                 // fuerza TSX (evita que Vite tome App.jsx si existe)
import AdminRoute from "./pages/AdminRoute"; // /admin (valida correo de admin y muestra bienvenida)
import Dashboard from "./pages/Dashboard";   // /dashboard real

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Inicio normal (usuarios) */}
        <Route path="/" element={<App />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminRoute />} />

        {/* Ruta a la que te manda el admin */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

        {/* Pagos y accesos */}
        <Route path="/admin/payments" element={<AdminPayments />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
