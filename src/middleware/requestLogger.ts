import type { Request, Response, NextFunction } from "express";

// Helper local de fecha
const obtenerFecha = () => {
  return new Date().toLocaleString('es-MX', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false 
  });
};

// Traductor de rutas a lenguaje humano
const interpretarSolicitud = (method: string, url: string): string => {
  // TAREAS
  const idTarea = url.match(/\/api\/tareas\/(\d+)/)?.[1];
  if (url.includes('/entregar') && method === 'POST') return `🚀 Entregando Tarea #${idTarea}`;
  if (url.includes('/misTareas')) return "📋 Usuario consultando sus pendientes";
  if (url.includes('/api/tareas') && method === 'POST') return "✨ Creando nueva Tarea";
  if (url.includes('/api/tareas') && method === 'GET' && !idTarea) return "🗂️ Listando todas las Tareas";
  if (url.includes('/api/tareas') && method === 'GET' && idTarea) return `🔍 Viendo detalle Tarea #${idTarea}`;
  
  // USUARIOS & NOTIFICACIONES
  const idUsuario = url.match(/\/api\/usuarios\/(\d+)/)?.[1];
  if (url.includes('/subscribe')) return `🔔 Usuario #${idUsuario} activando notificaciones`;
  if (url.includes('/api/usuarios') && method === 'GET') return "👥 Listando personal";

  // AUTH
  if (url.includes('/login')) return "🔑 Inicio de Sesión";
  if (url.includes('/verify')) return "👤 Verificación de Token (Auto-login)";

  return "⚡ Operación General del Sistema";
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // 1. FILTRO DE BASURA (No loguear imágenes ni JS estático)
  const ignorar = ['.js', '.css', '.png', '.jpg', '.webp', '.svg', '.ico', '.map', 'json'];
  const esBasura = ignorar.some(ext => req.path.endsWith(ext));
  const esSalud = req.path.includes('health') || req.path.includes('sw.js');

  if (esBasura || esSalud) return next();

  // 2. LOG DE ENTRADA
  const fecha = obtenerFecha();
  const historia = interpretarSolicitud(req.method, req.path);
  const origen = req.headers.origin ? "🌐 WEB" : "📱 APP";
  
  console.log(`[${fecha}] 📥 ${origen} | ${historia.padEnd(40)} | Solicitando: ${req.path}`);

  // 3. LOG DE SALIDA (Cuando termina la petición)
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    // Icono según el estatus
    let icon = '🟢';
    if (status >= 400) icon = '⚠️';
    if (status >= 500) icon = '🔥';

    console.log(`[${obtenerFecha()}] ${icon} FIN | Estatus: ${status} ${res.statusMessage || ''} | Tiempo: ${duration}ms`);
    if(status >= 400) console.log('---------------------------------------------------------------');
  });

  next();
};