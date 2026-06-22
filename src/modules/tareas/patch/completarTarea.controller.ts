import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema } from "../schemas/tarea.schema.js";
import { tareaConRelacionesInclude } from "../helpers/prisma.constants.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js";
import { registrarBitacora } from "../../../services/logger.service.js"; 
import { puedeRevisarOAutorizarTarea } from "../helpers/permisosTareas.helper.js";

export const completarTarea = safeAsync(async (req: Request, res: Response) => {
  const { id: tareaId } = paramsSchema.parse(req.params);
  const user = req.user!;

  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: { 
        responsables: { select: { usuarioId: true } },
        departamento: { select: { nombre: true } }, // Obtenemos Depto
        asignador: { select: { departamentoId: true } }
    },
  });

  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  // En tareas externas, solo autoriza el departamento origen.
  const permitido = puedeRevisarOAutorizarTarea(tarea, user);

  if (!permitido) return res.status(403).json({ error: "No tienes permiso para validar esta tarea." });

  // Actualizar
  const tareaActualizada = await prisma.tarea.update({
    where: { id: tareaId },
    data: { estatus: "CONCLUIDA", fechaConclusion: new Date() },
    include: tareaConRelacionesInclude,
  });

  // Notificar
  const ids = tarea.responsables.map((r) => r.usuarioId);
  sendNotificationToUsers(ids, `Tarea Validada`, `"${tarea.tarea}" ha sido CONCLUIDA.`, `/admin`);

  // --- LOG BITÁCORA (Con Departamento) ---
  await registrarBitacora(
    "ACTUALIZAR_TAREA",
    `${user.nombre} VALIDÓ y CERRÓ la tarea "${tarea.tarea}" (ID: ${tareaId}).`,
    user.id,
    { 
        tareaId, 
        departamento: tarea.departamento.nombre,
        accion: "VALIDACION_MANUAL",
        estatusNuevo: "CONCLUIDA" 
    }
  );
  // ------------------------------------------

  res.json({ ...tareaActualizada, responsables: tareaActualizada.responsables.map((r) => r.usuario) });
});
