import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { Moon, Sun } from "lucide-react";

const ADMIN_EMAIL = "admindropdrop@dropdrop.net";

/* Fondo con estrellas */
function Starfield() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  const points = useMemo(
    () =>
      Array.from({ length: 2000 }, () => [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
      ]).flat(),
    []
  );
  const flicker = useMemo(
    () =>
      Array.from({ length: 120 }, () => [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ]).flat(),
    []
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.x = mouse.y * 0.2;
      groupRef.current.rotation.y = mouse.x * 0.3;
      groupRef.current.children.forEach((child, i) => {
        if (child instanceof THREE.Points && i === 1) {
          const material = child.material as THREE.PointsMaterial;
          material.opacity = 0.4 + Math.sin(t * 2 + i) * 0.3;
        }
      });
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, Math.PI / 4]}>
      <Points positions={new Float32Array(points)} stride={3}>
        <PointMaterial transparent size={0.02} sizeAttenuation depthWrite={false} />
      </Points>
      <Points positions={new Float32Array(flicker)} stride={3}>
        <PointMaterial transparent size={0.04} opacity={0.6} sizeAttenuation depthWrite={false} />
      </Points>
    </group>
  );
}

/* Logo con parallax */
function FloatingLogo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
    };
    const reset = () => (el.style.transform = "rotateY(0) rotateX(0) scale(1)");
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="relative transition-transform duration-300 ease-out bg-white rounded-3xl p-8 shadow-[0_0_60px_rgba(70,139,230,0.4)] border border-[#93BFEF]/30 hover:shadow-[0_0_80px_rgba(70,139,230,0.6)]"
      style={{ perspective: "1000px" }}
    >
      <div className="absolute inset-0 rounded-3xl animate-glowPulse bg-[radial-gradient(circle_at_center,_rgba(70,139,230,0.25),_transparent_70%)] pointer-events-none" />
      <img src="/logohot.png" alt="Logo Productos Hot" className="w-[420px] object-contain select-none relative z-10" />
    </div>
  );
}

export default function AdminRoute() {
  const navigate = useNavigate();

  // Tema
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme:dark") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme:dark", darkMode ? "1" : "0");
  }, [darkMode]);

  // Estado de login admin
  const emailFromQuery = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get("email") ?? ""; }
    catch { return ""; }
  }, []);
  const [email, setEmail] = useState(emailFromQuery);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  function validateAndEnter() {
    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      sessionStorage.setItem("isAdmin", "1");   // ← marca sesión admin
      setIsAdmin(true);
      setErrorMsg("");
    } else {
      sessionStorage.removeItem("isAdmin");     // ← limpia si falla
      setIsAdmin(false);
      setErrorMsg("Correo no autorizado para acceso de administrador.");
    }
  }

  useEffect(() => {
    if (emailFromQuery && emailFromQuery.trim().toLowerCase() === ADMIN_EMAIL) {
      sessionStorage.setItem("isAdmin", "1");   // ← autologin marca admin
      setIsAdmin(true);
    }
  }, [emailFromQuery]);

  // ── Vista de bienvenida Admin (tras validar correctamente)
  if (isAdmin) {
    return (
      <div
        className={`relative min-h-screen flex items-center justify-center overflow-hidden transition-all duration-700 ${
          darkMode
            ? "bg-gradient-to-br from-[#0a0a0a] via-[#0b1a30] to-[#092F64]"
            : "bg-gradient-to-br from-[#E9F5FF] via-[#93BFEF] to-[#1A5799]"
        }`}
      >
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 1] }}>
            <ambientLight intensity={0.5} />
            <Starfield />
          </Canvas>
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-6 right-6 bg-white/20 dark:bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20 hover:scale-110 transition z-20"
          title="Cambiar tema"
        >
          {darkMode ? <Sun className="text-yellow-300" /> : <Moon className="text-blue-600" />}
        </button>

        <div className="flex flex-col md:flex-row w-[1250px] max-w-[95%] bg-white/10 dark:bg-black/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border border-white/20 animate-fadeInUp relative z-10">
          {/* Izquierda: logo */}
          <div className="md:w-1/2 w-full flex items-center justify-center bg-white p-12">
            <FloatingLogo />
          </div>

          {/* Derecha: tarjeta admin */}
          <div className="md:w-1/2 w-full relative p-16 bg-gradient-to-br from-[#1A5799]/85 via-[#468BE6]/70 to-[#E9F5FF]/70 dark:from-[#0E1A2E] dark:to-[#000000] text-white flex flex-col justify-center">
            <h2 className="text-5xl font-extrabold mb-4">¡Bienvenido, Admin!</h2>
            <p className="text-blue-100 mb-8 text-lg">Acceso completo a todos los países y paneles.</p>

            <div className="bg-white/15 rounded-xl px-5 py-4 mb-6">
              <p className="text-white/90 text-sm">Correo verificado</p>
              <p className="text-lg font-semibold">Cuenta de administrador activa</p>
            </div>

            <div className="bg-white text-blue-900 rounded-xl px-5 py-4 mb-8">
              <p className="font-semibold text-lg">🚀 ¡Vamos a ser millonarios pronto!</p>
              <p className="text-sm text-blue-700/80">Foco, datos y velocidad.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-white text-blue-700 font-semibold hover:bg-white/90 transition shadow"
              >
                Ir al Dashboard
              </button>
              <button
                onClick={() => navigate("/admin/payments")}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow"
              >
                Gestión de pagos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form de acceso (antes de validar admin)
  return (
    <div
      className={`relative min-h-screen flex items-center justify-center overflow-hidden transition-all duration-700 ${
        darkMode
          ? "bg-gradient-to-br from-[#0a0a0a] via-[#0b1a30] to-[#092F64]"
          : "bg-gradient-to-br from-[#E9F5FF] via-[#93BFEF] to-[#1A5799]"
      }`}
    >
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 1] }}>
          <ambientLight intensity={0.5} />
          <Starfield />
        </Canvas>
      </div>

      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-6 right-6 bg-white/20 dark:bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20 hover:scale-110 transition z-20"
        title="Cambiar tema"
      >
        {darkMode ? <Sun className="text-yellow-300" /> : <Moon className="text-blue-600" />}
      </button>

      <div className="flex flex-col md:flex-row w-[1250px] max-w-[95%] bg-white/10 dark:bg-black/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border border-white/20 animate-fadeInUp relative z-10">
        {/* Izquierda: logo */}
        <div className="md:w-1/2 w-full flex items-center justify-center bg-white p-12">
          <FloatingLogo />
        </div>

        {/* Derecha: formulario de acceso admin */}
        <div className="md:w-1/2 w-full relative p-16 bg-gradient-to-br from-[#1A5799]/85 via-[#468BE6]/70 to-[#E9F5FF]/70 dark:from-[#0E1A2E] dark:to-[#000000] text-white flex flex-col justify-center">
          <h2 className="text-5xl font-extrabold mb-4">Acceso Admin</h2>
          <p className="text-blue-100 mb-10 text-lg">Ingresa el correo de administrador para continuar.</p>

          <div className="space-y-6">
            <input
              type="email"
              placeholder="correo@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validateAndEnter()}
              className="w-full rounded-xl px-5 py-3 text-gray-900 border border-white/40 bg-white/95 text-lg focus:outline-none focus:ring-2 focus:ring-[#468BE6]"
            />
            <button
              onClick={validateAndEnter}
              disabled={!email}
              className={`relative w-full font-semibold py-3.5 text-lg rounded-xl text-white transition-all ${
                email
                  ? "bg-gradient-to-r from-[#1A5799] via-[#468BE6] to-[#93BFEF] shadow-[0_0_25px_rgba(70,139,230,0.7)] hover:scale-[1.05]"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Ingresar
            </button>
            {errorMsg && <p className="text-red-200 font-medium">{errorMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
