import webpush from "web-push";
import { prisma } from "../../../config/db.js";
import { envs } from "../../../config/envs.js";
import { registrarBitacora } from "../../../services/logger.service.js"; // <--- NUEVO: Importamos el logger

// Configuración inicial (Tu configuración original)
webpush.setVapidDetails(
  envs.VAPID_SUBJECT,
  envs.VAPID_PUBLIC_KEY,
  envs.VAPID_PRIVATE_KEY
);

interface NotificationOptions {
  printReport?: boolean;
}

export const sendNotificationToUsers = async (
  userIds: number[],
  title: string,
  body: string,
  url: string = "/mis-tareas",
  options: NotificationOptions = { printReport: false }
) => {
  // Limpiar IDs duplicados y vacíos
  const uniqueIds = [...new Set(userIds)].filter(id => id);
  if (uniqueIds.length === 0) return;

  try {
    // 1. Busca suscripciones SOLO de usuarios ACTIVOS
    const suscripciones = await prisma.pushSubscription.findMany({
      where: {
        usuarioId: { in: uniqueIds },
        usuario: { estatus: 'ACTIVO' } 
      },
      include: {
        usuario: { select: { id: true, username: true, nombre: true } } // <--- Traemos 'nombre' e 'id' para el Log
      }
    });

    if (suscripciones.length === 0) {
      if (options.printReport) {
        console.log(`ℹ️ [Push] No hay dispositivos activos para: [${uniqueIds.join(', ')}]`);
      }
      return;
    }

    // 2. Payload (Tu configuración original)
    const payload = JSON.stringify({
      title,
      body,
      icon: "/img/01_Cuadra.webp",
      data: { url },
    });

    // Contadores
    let enviados = 0;
    let fallidos = 0;
    let eliminados = 0;
    
    // Lista para el Log de Bitácora (NUEVO)
    const usuariosNotificados: string[] = []; 

    // 3. Envío Paralelo
    const promesasEnvio = suscripciones.map((sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      return webpush.sendNotification(pushConfig, payload)
        .then(() => {
          enviados++;
          // Guardamos el nombre de quien recibió correctamente (sin duplicar en la lista visual)
          if (!usuariosNotificados.includes(sub.usuario.nombre)) {
            usuariosNotificados.push(sub.usuario.nombre);
          }
        })
        .catch(async (err) => {
          fallidos++;
          // 410 Gone / 404 Not Found = Suscripción muerta (limpieza automática)
          if (err.statusCode === 410 || err.statusCode === 404) {
            eliminados++;
            console.log(`🗑️ Eliminando suscripción caduca de ${sub.usuario.username}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } else {
            console.error(`⚠️ Error envío a ${sub.usuario.username}:`, err.message);
          }
        });
    });

    await Promise.all(promesasEnvio);

    // --- 4. NUEVO: REGISTRO EN BITÁCORA (LOG) ---
    // Solo registramos si al menos a una persona le llegó
    if (usuariosNotificados.length > 0) {
      await registrarBitacora(
        "NOTIFICACION",
        `Notificación enviada a: ${usuariosNotificados.join(", ")}. Asunto: "${title}"`,
        null, // null porque es el sistema quien dispara el evento técnico de envío
        { title, body, totalEnviados: enviados, totalFallidos: fallidos }
      );
    }
    // ---------------------------------------------

    // 5. Reporte detallado (Tu reporte original)
    if (options.printReport) {
      console.log(`📊 PUSH REPORT ["${title}"]`);
      console.log(`   ├─ 🎯 Objetivo: ${uniqueIds.length} usuarios`);
      console.log(`   ├─ 📱 Dispositivos: ${suscripciones.length}`);
      console.log(`   ├─ 📡 Enviados: ${enviados}`);
      console.log(`   ├─ ❌ Fallos: ${fallidos}`);
      console.log(`   └─ 🗑️ Limpiados: ${eliminados}`);
      console.log('--------------------------------------------------');
    }

  } catch (error) {
    console.error("❌ Error CRÍTICO en notificaciones:", error);
  }
};