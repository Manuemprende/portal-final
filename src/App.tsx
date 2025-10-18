import { useState, useEffect, Suspense, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { verificarUsuarioPorPedidos } from "./services/dropdrop";
import Dashboard from "./pages/Dashboard";

// ⬇️ NUEVO: Supabase para detectar si el correo es admin
import { createClient } from "@supabase/supabase-js";

// Lee URL y ANON desde .env (Vite o fallback a vars normales)
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || (window as any).VITE_SUPABASE_URL || (import.meta as any).env?.SUPABASE_URL;
const SUPABASE_ANON =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (window as any).VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.SUPABASE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON
    ? createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: false },
      })
    : null;

/* 🌌 Fondo Parallax con partículas 3D (tu código base) */
function Starfield() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  const points = Array.from({ length: 2000 }, () => [
    (Math.random() - 0.5) * 12,
    (Math.random() - 0.5) * 12,
    (Math.random() - 0.5) * 12,
  ]);

  const flickerPoints = Array.from({ length: 120 }, () => [
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
  ]);

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
      <Points positions={new Float32Array(points.flat())} stride={3}>
        <PointMaterial transparent size={0.02} sizeAttenuation depthWrite={false} />
      </Points>
      <Points positions={new Float32Array(flickerPoints.flat())} stride={3}>
        <PointMaterial transparent size={0.04} opacity={0.6} sizeAttenuation depthWrite={false} />
      </Points>
    </group>
  );
}

/* 🌀 Logo flotante (tu código base) */
function FloatingLogoInteractive() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
    };
    const reset = () => {
      el.style.transform = "rotateY(0deg) rotateX(0deg) scale(1)";
    };
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
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
      <img src="logohot.png" alt="Logo Productos Hot" className="w-[420px] object-contain select-none relative z-10" />
    </div>
  );
}

/* 🔑 Componente Principal */
export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [email, setEmail] = useState("");
  const [ventas, setVentas] = useState(0);
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(false);

  // Vista
  const [showDashboard, setShowDashboard] = useState(false);

  // NUEVO: estado admin
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Verifica ventas/autorización (tu flujo)
  useEffect(() => {
    if (!email) return;
    setVerificando(true);
    verificarUsuarioPorPedidos(email).then((res) => {
      setVentas(res.ventas);
      setAutorizado(res.autorizado);
      setVerificando(false);

      if (res.autorizado) {
        window.parent.postMessage(
          { tipo: "DROP_VALIDACION_OK", usuario: res.usuario, ventas: res.ventas },
          "*"
        );
      }
    });
  }, [email]);

  // NUEVO: si hay email, consulta en Supabase si ese correo es admin (profiles.role='admin')
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!email || !supabase) {
        setIsAdmin(false);
        return;
      }
      // Buscamos por email directamente en profiles (tu tabla)
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (!cancel) {
        if (error) {
          console.warn("Supabase profiles error:", error.message);
          setIsAdmin(false);
        } else {
          setIsAdmin((data?.role as string) === "admin");
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [email]);

  const handleEntrar = () => {
    if (autorizado) {
      // Si es admin, mostramos la bienvenida especial; si no, dashboard directo
      if (isAdmin) {
        // nos quedamos en la misma vista (admin-welcome) hasta que toque botones
        // no hacemos setShowDashboard aquí
        // solo retornamos para que se renderice admin-welcome
        return;
      }
      setShowDashboard(true);
    }
  };

  // Si no es admin y ya está autorizado → Dashboard
  if (showDashboard && autorizado && !isAdmin) {
    return <Dashboard />;
  }

  // Si es admin y está autorizado → Bienvenida Admin
  if (autorizado && isAdmin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 dark:from-[#0E1A2E] dark:via-[#0A1530] dark:to-black">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          {/* Lado izquierdo: logo */}
          <div className="bg-white/90 rounded-3xl shadow-xl p-8 flex items-center justify-center">
            <div className="w-full aspect-square rounded-2xl border border-slate-200 flex items-center justify-center">
              <img src="/logo512.png" alt="DropDrop Admin" className="w-4/5 h-auto opacity-90" />
            </div>
          </div>

          {/* Lado derecho: bienvenida admin */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl shadow-xl p-8 text-white">
            <div className="mb-6">
              <h1 className="text-4xl md:text-5xl font-extrabold drop-shadow">¡Bienvenido, Admin!</h1>
              <p className="mt-3 text-white/90">
                Accede al panel de productos y controla todos los países.
              </p>
            </div>

            <div className="bg-white/15 rounded-xl px-5 py-4 mb-5">
              <p className="text-white/90 text-sm">Correo verificado</p>
              <p className="text-lg font-semibold">{email}</p>
            </div>

            <div className="bg-white text-blue-900 rounded-xl px-5 py-4 mb-6">
              <p className="font-semibold text-lg">🚀 ¡Vamos a ser millonarios pronto!</p>
              <p className="text-sm text-blue-700/80">
                Mantén el foco: datos, decisiones y velocidad.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowDashboard(true)}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-white text-blue-700 font-semibold hover:bg-white/90 transition shadow"
              >
                Ir al Dashboard
              </button>
              <a
                href="/hot"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-blue-900/40 text-white font-semibold hover:bg-blue-900/50 transition border border-white/20"
              >
                Ver Productos Hot
              </a>
            </div>

            <p className="mt-6 text-xs text-white/70">
              Esta vista es solo para administradores. Los usuarios normales verán el inicio con acceso a Chile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de Login (tu diseño original)
  return (
    <div
      className={`relative min-h-screen flex items-center justify-center overflow-hidden transition-all duration-700 ${
        darkMode
          ? "bg-gradient-to-br from-[#0a0a0a] via-[#0b1a30] to-[#092F64]"
          : "bg-gradient-to-br from-[#E9F5FF] via-[#93BFEF] to-[#1A5799]"
      }`}
    >
      {/* 🌠 Fondo 3D */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 1] }}>
          <ambientLight intensity={0.5} />
          <Suspense fallback={null}>
            <Starfield />
          </Suspense>
        </Canvas>
      </div>

      {/* 🌙 Toggle tema */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-6 right-6 bg-white/20 dark:bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20 hover:scale-110 transition z-20"
        title="Cambiar tema"
      >
        {darkMode ? <Sun className="text-yellow-300" /> : <Moon className="text-blue-600" />}
      </button>

      {/* 🧩 Contenedor principal */}
      <div className="flex flex-col md:flex-row w-[1250px] max-w-[95%] bg-white/10 dark:bg-black/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border border-white/20 animate-fadeInUp relative z-10">
        {/* 🧊 Logo */}
        <div className="md:w-1/2 w-full flex items-center justify-center bg-white p-12">
          <FloatingLogoInteractive />
        </div>

        {/* 🔐 Validación */}
        <div className="md:w-1/2 w-full relative p-16 bg-gradient-to-br from-[#1A5799]/85 via-[#468BE6]/70 to-[#E9F5FF]/70 dark:from-[#0E1A2E] dark:to-[#000000] text-white flex flex-col justify-center">
          <h2 className="text-5xl font-extrabold mb-4 text-center">¡Bienvenido!</h2>
          <p className="text-center text-blue-100 mb-12 text-lg">Accede al panel de productos DropHot 🚀</p>

          <div className="space-y-6">
            <input
              type="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-5 py-3 text-gray-900 border border-white/40 bg-white/95 text-lg focus:outline-none focus:ring-2 focus:ring-[#468BE6]"
            />

            <button
              onClick={handleEntrar}
              disabled={!autorizado}
              className={`relative w-full font-semibold py-3.5 text-lg rounded-xl text-white transition-all ${
                autorizado
                  ? "bg-gradient-to-r from-[#1A5799] via-[#468BE6] to-[#93BFEF] shadow-[0_0_25px_rgba(70,139,230,0.7)] hover:scale-[1.05]"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {verificando
                ? "Verificando..."
                : autorizado
                ? `Ingresar (${ventas} entregas)`
                : `Pedidos entregados: ${ventas} / 5`}
            </button>

            {autorizado && (
              <p className="text-green-400 text-center font-medium">
                ✅ Acceso habilitado. ¡Tienes {ventas} entregas completadas!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
