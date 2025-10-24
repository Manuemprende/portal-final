import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Definimos la forma del estado, incluyendo el país y la función para cambiarlo.
type CountryState = {
  country: string;
  setCountry: (countryCode: string) => void;
};

// Leemos los países permitidos de la sesión o usamos un array vacío como fallback.
const getAllowedCountries = (): string[] => {
  try {
    const session = sessionStorage.getItem('user-profile');
    if (!session) return ['cl']; // Si no hay sesión, default a Chile
    
    const profile = JSON.parse(session);
    return profile?.allowed_countries ?? ['cl']; // Si no hay países, default a Chile
  } catch (error) {
    console.error("Error reading allowed countries from session:", error);
    return ['cl']; // En caso de error, default a Chile
  }
};

// Leemos el país guardado o usamos el primer país permitido como inicial.
const getInitialCountry = (): string => {
    const allowed = getAllowedCountries();
    const storedCountry = localStorage.getItem('selected_country');
    // Si hay un país guardado y está permitido, lo usamos. Si no, usamos el primero de la lista.
    if (storedCountry && allowed.includes(storedCountry)) {
        return storedCountry;
    }
    return allowed[0] ?? 'cl'; // Default a Chile si no hay ninguno permitido
};


export const useCountryStore = create<CountryState>()(
  persist(
    (set) => ({
      // Estado inicial del país
      country: getInitialCountry(),
      
      // Acción para actualizar el país
      setCountry: (countryCode: string) => {
        const allowed = getAllowedCountries();
        if (allowed.includes(countryCode)) {
          set({ country: countryCode });
        } else {
          // Opcional: mostrar un toast o log si se intenta cambiar a un país no permitido
          console.warn(`Intento de cambiar a un país no permitido: ${countryCode}`);
        }
      },
    }),
    {
      // Nombre con el que se guardará en localStorage
      name: 'selected_country',
      // Solo persistimos el código del país
      partialize: (state) => ({ country: state.country }),
    }
  )
);
