import cors from "cors"; // Importamos la librería que gestiona los headers de seguridad HTTP
import dotenv from "dotenv";
dotenv.config();

// ----------------------------------------------------------------------
// 1. LISTA BLANCA (WHITELIST) - DOMINIOS DE CONFIANZA
// ----------------------------------------------------------------------
// Aquí ponemos las direcciones EXACTAS que sabemos que son seguras.
const baseAllowedOrigins = [
  "https://tareas-mbc.netlify.app",              // 🚀 NUEVO: Tu Frontend real en Netlify (SIN BARRA '/')
  "https://tareas-calidad-mbc.mbc-bitacoras.me", // (Opcional) Dejamos el monolito viejo un mes por seguridad
  "http://localhost:5173",                       // Frontend local (Vite)
  "http://127.0.0.1:5173",                       // Frontend local (IP Loopback)
  "http://localhost:3000",                       // Backend local
  "http://10.0.2.2:5173"                         // Emulador Android
];

// Obtener orígenes adicionales configurados en .env (útil para Netlify en prod)
const envOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) 
  : [];

const allowedOrigins = [...baseAllowedOrigins, ...envOrigins];

// ----------------------------------------------------------------------
// 2. HELPER DE FECHA
// ----------------------------------------------------------------------
// Función simple para saber cuándo ocurrió un bloqueo en los logs.
const obtenerFecha = () => {
  return new Date().toLocaleString('es-MX', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false 
  });
};

// ----------------------------------------------------------------------
// 3. CONFIGURACIÓN EXPORTADA
// ----------------------------------------------------------------------
export const corsConfig = cors({
  // La función 'origin' decide quién entra y quién no.
  // Recibe:
  // - origin: La URL de quien intenta conectarse
  // - callback: Una función que llamamos para decir "Sí" (null, true) o "No" (Error)
  origin: (origin, callback) => {
    
    // CASO A: SOLICITUDES SIN ORIGEN (BACKEND-TO-BACKEND / APPS / POSTMAN)
    // Las apps móviles (React Native, Android) y herramientas como Postman 
    // a veces NO envían el header "Origin" porque no son navegadores web.
    // Si no tiene origen, asumimos que es una herramienta interna y permitimos el paso.
    if (!origin) return callback(null, true);

    // CASO B: VERIFICACIÓN DE REGLAS
    const isAllowed = 
        // 1. ¿Está la URL exacta en mi lista de arriba?
        allowedOrigins.includes(origin) || 
        
        // 2. ¿Es una red local doméstica/oficina? (Cualquier IP que empiece con 192.168...)
        // Esto permite que tus compañeros en la misma red Wi-Fi accedan a tu PC.
        origin.startsWith("http://192.168.") || 
        
        // 3. ¿Es una red corporativa específica? (Cualquier IP que empiece con 200.1...)
        origin.startsWith("http://200.1.") ||
        
        // 4. REGLA LAXA DE DESARROLLO (VITE)
        // Permite CUALQUIER IP (incluso desconocida) siempre y cuando 
        // el puerto sea el 5173 (el de Vite). 
        // Útil si pruebas desde tu celular conectado a la red local.
        origin.includes(":5173");

    // DECISIÓN FINAL
    if (isAllowed) {
        // ✅ SEMÁFORO VERDE: null = sin error, true = permitir acceso
        callback(null, true);
    } else {
        // ⛔ SEMÁFORO ROJO: Bloqueamos y registramos el intento
        console.error(`[${obtenerFecha()}] ⛔ BLOQUEO CORS: IP ${origin} no autorizada`);
        // Devuelve un error al cliente (El navegador verá un error de CORS)
        callback(new Error("No permitido por CORS"));
    }
  },
  
  // Permite el envío de Cookies y Headers de autorización (Tokens)
  credentials: true
});