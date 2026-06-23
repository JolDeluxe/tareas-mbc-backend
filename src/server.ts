import express from "express";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

// 1. IMPORTAR CONFIGURACIONES Y MIDDLEWARES
import { envs } from "./config/envs.js";            
import { corsConfig } from "./config/cors.js";      
import { requestLogger } from "./middleware/requestLogger.js"; 
import { errorHandler } from "./middleware/errorHandler.js";   
import { iniciarCronJobs } from "./services/cron.service.js";

// 2. IMPORTAR RUTAS
import tareasRouter from "./modules/tareas/tareas.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import usuariosRouter from "./modules/usuarios/usuarios.routes.js";
import departamentosRouter from "./modules/departamentos/departamentos.routes.js";
import logsRouter from "./modules/logs/logs.routes.js";

// --- CONFIGURACIÓN INICIAL ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// --- MIDDLEWARES GLOBALES ---
app.use(corsConfig);          // 1. Seguridad CORS
app.use(requestLogger);       // 2. Logging
app.use(express.json());      // 3. Parser JSON
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // 4. Servir imágenes de evidencias

// --- SALUDO EN LA RAÍZ (API HEADLESS) ---
app.get("/", (req, res) => {
  const ahora = new Date();
  res.status(200).json({
    ok: true,
    api: "Gestor de Calidad - MBC",
    estatus: "ONLINE",
    motor: "Bun Runtime nativo",
    puerto: envs.PORT,
    horaUtc: ahora.toISOString(),
    horaMexico: ahora.toLocaleString("es-MX", { timeZone: "America/Mexico_City" })
  });
});

// --- RUTAS DE API ---
app.get("/api/health", (req, res) => res.json({ status: "OK", memoria: process.memoryUsage().rss }));
app.use("/api/auth", authRouter);
app.use("/api/tareas", tareasRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/departamentos", departamentosRouter);
app.use("/api/logs", logsRouter);

// --- SERVICIOS EN 2do PLANO ---
iniciarCronJobs(); // <--- Aquí arranca el servicio de auto-validación y notificaciones

// --- MANEJO DE ERRORES ---
app.use(errorHandler);

// --- INICIO DEL SERVIDOR ---
app.listen(envs.PORT, "0.0.0.0", () => {
  console.log(`\n[${new Date().toLocaleString()}] 🚀 CEREBRO API LISTO EN PUERTO ${envs.PORT}\n`);
});