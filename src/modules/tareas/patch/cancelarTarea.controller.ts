import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema } from "../schemas/tarea.schema.js";
import { tareaConRelacionesInclude } from "../helpers/prisma.constants.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js";
import { registrarBitacora } from "../../../services/logger.service.js"; 
import { puedeRevisarOAutorizarTarea } from "../helpers/permisosTareas.helper.js";

export const cancelarTarea = safeAsync(async (req: Request, res: Response) => {
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

  const permitido = puedeRevisarOAutorizarTarea(tarea, user);

  if (!permitido) return res.status(403).json({ error: "No tienes permiso para cancelar esta tarea." });

  const tareaActualizada = await prisma.tarea.update({
    where: { id: tareaId },
    data: { 
      estatus: "CANCELADA", 
      fechaConclusion: new Date()
    },
    include: tareaConRelacionesInclude,
  });

  const ids = tarea.responsables.map((r) => r.usuarioId);
  sendNotificationToUsers(ids, `Tarea Cancelada`, `"${tarea.tarea}" ha sido CANCELADA.`, `/admin`);

  // --- LOG BITÁCORA (Con Departamento) ---
  await registrarBitacora(
    "CAMBIO_ESTATUS",
    `${user.nombre} CANCELÓ la tarea "${tarea.tarea}" (ID: ${tareaId}).`,
    user.id, 
    { 
        tareaId, 
        departamento: tarea.departamento.nombre,
        estatusAnterior: tarea.estatus, 
        estatusNuevo: "CANCELADA",
    }
  );
  // ------------------------------------------

  res.json({ ...tareaActualizada, responsables: tareaActualizada.responsables.map((r) => r.usuario) });
});
