import cron from 'node-cron';
import { prisma } from '../config/db.js';
import { sendNotificationToUsers } from '../modules/tareas/helpers/notificaciones.helper.js';
import { esDiaNoLaborable } from '../utils/holidayUtils.js';
import { registrarBitacora } from './logger.service.js';

export const iniciarCronJobs = () => {
  console.log("⏰ Servicio de Cron Jobs iniciado (Horario: America/Mexico_City)...");

  const timezone = "America/Mexico_City";

  // ---------------------------------------------------------------------
  // JOB 1: Auto-Validación de Tareas en Revisión (> 5 días)
  // Se ejecuta cada hora: '0 * * * *'
  // ---------------------------------------------------------------------
  cron.schedule("0 * * * *", async () => {
    // console.log("Running Cron: Buscando tareas para auto-validación...");
    try {
      // 1. Calcular la fecha de corte (Hace 5 días exactos)
      const diasLimite = 5;
      const fechaCorte = new Date();
      fechaCorte.setDate(fechaCorte.getDate() - diasLimite);

      // 2. Buscar tareas candidatas
      const tareasVencidas = await prisma.tarea.findMany({
        where: {
          estatus: "EN_REVISION",
          fechaEntrega: { lt: fechaCorte },
        },
        include: {
            responsables: { select: { usuarioId: true } },
            departamento: { select: { nombre: true } }
        }
      });

      if (tareasVencidas.length > 0) {
        console.log(`🔎 CRON: Encontradas ${tareasVencidas.length} tareas para auto-validar.`);
        for (const tarea of tareasVencidas) {
           await autoValidarTarea(tarea);
        }
      }
    } catch (error) {
      console.error("❌ Error en Cron de Auto-Validación:", error);
    }
  }, { timezone });

  // ---------------------------------------------------------------------
  // JOB 2: Notificaciones Matutinas (09:00 AM Lunes-Viernes)
  // ---------------------------------------------------------------------
  cron.schedule('0 9 * * 1-5', async () => {
    if (esDiaNoLaborable(new Date())) {
        console.log("☕ Hoy es día festivo (México). No se envían notificaciones matutinas.");
        return;
    }
    console.log("☀️ [09:00 AM] Ejecutando revisión matutina...");
    await procesarRecordatorios("MAÑANA");
  }, { timezone });

  // ---------------------------------------------------------------------
  // JOB 3: Notificaciones Vespertinas (04:30 PM Lunes-Viernes)
  // ---------------------------------------------------------------------
  cron.schedule('30 16 * * 1-5', async () => {
    if (esDiaNoLaborable(new Date())) {
        console.log("🏖️ Hoy es día festivo (México). No se envían alertas de salida.");
        return;
    }
    console.log("🌇 [04:30 PM] Ejecutando alerta de salida...");
    await procesarRecordatorios("TARDE");
  }, { timezone });
};

/**
 * Lógica auxiliar para cerrar una tarea individualmente
 */
async function autoValidarTarea(tarea: any) {
    try {
        await prisma.$transaction(async (tx) => {
            // A. Actualizar la tarea
            await tx.tarea.update({
                where: { id: tarea.id },
                data: {
                    estatus: "CONCLUIDA",
                    fechaConclusion: new Date(),
                    fechaRevision: new Date(),
                    feedbackRevision: "✅ Validación Automática: Cierre administrativo por sistema tras 5 días sin revisión manual.",
                    fueAutoValidada: true,
                }
            });

            // B. Registrar en Bitácora
            await registrarBitacora(
                "AUTO_VALIDACION",
                `El sistema cerró automáticamente la tarea "${tarea.tarea}" (ID: ${tarea.id}) por inactividad.`,
                null,
                {
                    tareaId: tarea.id,
                    departamento: tarea.departamento?.nombre,
                    diasEnRevision: 5,
                    accion: "CIERRE_AUTOMATICO"
                }
            );
        });

        // C. Notificar a los responsables
        const ids = tarea.responsables.map((r: any) => r.usuarioId);
        if (ids.length > 0) {
            sendNotificationToUsers(
                ids,
                "🤖 Tarea Validada Automáticamente",
                `Tu tarea "${tarea.tarea}" ha sido cerrada por el sistema tras 5 días de espera.`,
                "/mis-tareas"
            );
        }
    } catch (error) {
        console.error(`Error procesando tarea ${tarea.id}:`, error);
    }
}

const procesarRecordatorios = async (momento: "MAÑANA" | "TARDE") => {
  const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0);
  const hoyEnd = new Date(); hoyEnd.setHours(23, 59, 59, 999);

  try {
    // 1. ALERTA PARA ASIGNADORES
    const tareasPorRevisar = await prisma.tarea.findMany({
      where: { estatus: 'EN_REVISION' },
      select: { asignadorId: true }
    });

    const asignadoresMap = new Map<number, number>();
    
    tareasPorRevisar.forEach(t => {
      if (t.asignadorId) {
        const count = asignadoresMap.get(t.asignadorId) || 0;
        asignadoresMap.set(t.asignadorId, count + 1);
      }
    });

    for (const [asignadorId, cantidad] of asignadoresMap) {
      const titulo = momento === "MAÑANA" ? "🧐 Pendientes de Revisión" : "📤 Bandeja de Salida";
      const cuerpo = `Tienes ${cantidad} tarea(s) esperando tu aprobación. ¡No detengas el flujo!`;
      
      await sendNotificationToUsers([asignadorId], titulo, cuerpo, '/admin', { printReport: true });
    }

    // 2. ALERTA PARA RESPONSABLES
    
    // A. Vencen Hoy
    const vencenHoy = await prisma.tarea.findMany({
      where: { estatus: 'PENDIENTE', fechaLimite: { gte: hoyStart, lte: hoyEnd } },
      include: { responsables: { select: { usuarioId: true } } }
    });

    for (const tarea of vencenHoy) {
      const ids = tarea.responsables.map(r => r.usuarioId);
      const titulo = "📅 Vence Hoy";
      const cuerpo = momento === "MAÑANA" 
        ? `"${tarea.tarea}" vence hoy. ¡Organízate!` 
        : `"${tarea.tarea}" cierra hoy. ¿Lograrás terminarla?`;
        
      await sendNotificationToUsers(ids, titulo, cuerpo, '/mis-tareas', { printReport: true });
    }

    // B. Vencidas
    const vencidas = await prisma.tarea.findMany({
        where: { estatus: 'PENDIENTE', fechaLimite: { lt: hoyStart } },
        include: { responsables: { select: { usuarioId: true } } }
    });

    for (const tarea of vencidas) {
        const ids = tarea.responsables.map(r => r.usuarioId);
        const diffTime = Math.abs(new Date().getTime() - new Date(tarea.fechaLimite).getTime());
        const diasRetraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        const titulo = "🔥 URGENTE: Tarea Vencida";
        const cuerpo = `"${tarea.tarea}" tiene ${diasRetraso} días de retraso. ¡Entrégala ya!`;

        await sendNotificationToUsers(ids, titulo, cuerpo, '/mis-tareas', { printReport: true });
    }

    // C. Resumen Futuro (Solo Mañana)
    if (momento === "MAÑANA") {
        const pendientesFuturas = await prisma.tarea.findMany({
            where: { estatus: 'PENDIENTE', fechaLimite: { gt: hoyEnd } },
            include: { responsables: { select: { usuarioId: true } } }
        });

        const resumenUsuarios = new Map<number, number>();
        pendientesFuturas.forEach(t => {
            t.responsables.forEach(r => {
                const count = resumenUsuarios.get(r.usuarioId) || 0;
                resumenUsuarios.set(r.usuarioId, count + 1);
            });
        });

        for (const [usuarioId, cantidad] of resumenUsuarios) {
            await sendNotificationToUsers(
                [usuarioId], 
                "🚀 Resumen Diario", 
                `Tienes ${cantidad} tareas activas en curso. ¡A trabajar!`, 
                '/mis-tareas'
            );
        }
    }

  } catch (error) {
    console.error(`❌ Error procesando cron (${momento}):`, error);
  }
};