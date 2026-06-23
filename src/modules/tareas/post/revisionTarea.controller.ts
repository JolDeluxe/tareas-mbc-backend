import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema, revisionTareaSchema } from "../schemas/tarea.schema.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js";
import { registrarBitacora } from "../../../services/logger.service.js";
import { puedeRevisarOAutorizarTarea } from "../helpers/permisosTareas.helper.js";

export const revisionTarea = safeAsync(async (req: Request, res: Response) => {
  const { id: tareaId } = paramsSchema.parse(req.params);
  
  // Validamos datos recibidos: decision, feedback y opcionalmente nuevaFechaLimite
  const bodyParse = revisionTareaSchema.safeParse(req.body);
  if (!bodyParse.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: bodyParse.error.flatten().fieldErrors });
  }

  const { decision, feedback, nuevaFechaLimite } = bodyParse.data;
  const user = req.user!;

  // 1. Obtener tarea con información del asignador
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: { 
        responsables: { select: { usuarioId: true } },
        departamento: { select: { nombre: true } },
        asignador: { select: { id: true, rol: true, departamentoId: true } }
    },
  });

  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  // En tareas externas, solo revisa/autoriza el departamento origen.
  const permitido = puedeRevisarOAutorizarTarea(tarea, user);

  if (!permitido) return res.status(403).json({ error: "No tienes permiso para revisar esta tarea." });

  // Validación de Flujo: Solo se revisa lo que está EN_REVISION
  if (tarea.estatus !== "EN_REVISION") {
    return res.status(400).json({ error: "La tarea no está en etapa de revisión." });
  }

  let tareaActualizada;
  const idsResponsables = tarea.responsables.map((r) => r.usuarioId);

  // --- ESCENARIO A: APROBAR ---
  if (decision === "APROBAR") {
    /* LÓGICA:
       1. Estatus -> CONCLUIDA.
       2. fechaConclusion -> HOY (Cierre administrativo).
       3. fechaEntrega -> SE RESPETA (Es la fecha real en que el usuario cumplió).
    */
    tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estatus: "CONCLUIDA",
        fechaConclusion: req.body.fechaConclusion && !isNaN(Date.parse(req.body.fechaConclusion))
          ? new Date(req.body.fechaConclusion)
          : new Date(), 
        fechaRevision: req.body.fechaRevision && !isNaN(Date.parse(req.body.fechaRevision))
          ? new Date(req.body.fechaRevision)
          : new Date(),
        feedbackRevision: feedback ?? "Aprobada.",
      },
    });
    
    // Notificación
    sendNotificationToUsers(
        idsResponsables, 
        "✅ Tarea Aprobada", 
        `Tu entrega de "${tarea.tarea}" ha sido validada y cerrada.`, 
        `/mis-tareas`
    );
    
    // Log Bitácora
    await registrarBitacora(
      "ACTUALIZAR_TAREA",
      `Tarea "${tarea.tarea}" APROBADA por ${user.nombre}.`,
      user.id,
      { 
          tareaId, 
          departamento: tarea.departamento.nombre,
          decision: "APROBADA", 
          feedback 
      }
    );
  
  } else {
    // --- ESCENARIO B: RECHAZAR ---
    /* LÓGICA:
       1. La entrega no sirvió -> fechaEntrega = null.
       2. Estatus -> Regresa a PENDIENTE.
       3. ¿Se dio más tiempo? -> Actualizamos fechaLimite.
    */

    // Si el admin decidió extender el plazo, guardamos el historial del cambio
    if (nuevaFechaLimite) {
      await prisma.historialFecha.create({
        data: {
          fechaAnterior: tarea.fechaLimite,
          nuevaFecha: nuevaFechaLimite,
          motivo: `Rechazo/Corrección: ${feedback || "Ajuste por revisión"}`,
          tareaId: tareaId,
          modificadoPorId: user.id,
        },
      });
    }

    // Actualizamos la tarea
    tareaActualizada = await prisma.tarea.update({
      where: { id: tareaId },
      data: {
        estatus: "PENDIENTE",
        fechaEntrega: null, // Se anula la entrega porque fue rechazada
        fechaRevision: req.body.fechaRevision && !isNaN(Date.parse(req.body.fechaRevision))
          ? new Date(req.body.fechaRevision)
          : new Date(),
        feedbackRevision: feedback ?? "Se requieren correcciones.",
        // Si hay nueva fecha, la usamos. Si no, se queda la original.
        ...(nuevaFechaLimite && { fechaLimite: new Date(nuevaFechaLimite) }), 
      },
    });

    // Notificación
    sendNotificationToUsers(
        idsResponsables, 
        "⚠️ Tarea Rechazada", 
        `Se requiere corrección en "${tarea.tarea}". Feedback: ${feedback}`, 
        `/mis-tareas`
    );

    // Log Bitácora
    await registrarBitacora(
      "ACTUALIZAR_TAREA",
      `Tarea "${tarea.tarea}" RECHAZADA por ${user.nombre}. Regresa a PENDIENTE.`,
      user.id,
      { 
          tareaId, 
          departamento: tarea.departamento.nombre,
          decision: "RECHAZADA", 
          feedback, 
          nuevaFechaLimite: nuevaFechaLimite ? nuevaFechaLimite : "Sin cambio de fecha"
      }
    );
  }

  res.json({ message: `Tarea ${decision === "APROBAR" ? "Aprobada" : "Rechazada"}`, tarea: tareaActualizada });
});
