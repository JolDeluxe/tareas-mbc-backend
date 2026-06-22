import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema, historialSchema } from "../schemas/tarea.schema.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js"; 
import { registrarBitacora } from "../../../services/logger.service.js"; 

export const agregarHistorial = safeAsync(async (req: Request, res: Response) => {
  const { id: tareaId } = paramsSchema.parse(req.params);
  const bodyParse = historialSchema.safeParse(req.body);
  
  if (!bodyParse.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: bodyParse.error.flatten().fieldErrors });
  }

  const { fechaAnterior, nuevaFecha, motivo } = bodyParse.data;
  const user = req.user!;

  // MODIFICADO: Ahora incluimos el departamento en la consulta
  const tarea = await prisma.tarea.findUnique({ 
    where: { id: tareaId },
    include: { 
        responsables: { select: { usuarioId: true } },
        departamento: { select: { nombre: true } } // <--- AGREGADO
    } 
  });

  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  const nuevoHistorial = await prisma.historialFecha.create({
    data: {
      fechaAnterior,
      nuevaFecha,
      motivo: motivo ?? null,
      tarea: { connect: { id: tareaId } },
      modificadoPor: { connect: { id: user.id } },
    },
    include: { modificadoPor: { select: { nombre: true } } },
  });

  // Notificar
  const ids = tarea.responsables.map(r => r.usuarioId);
  const fechaFormat = new Date(nuevaFecha).toLocaleDateString('es-MX');
  
  await sendNotificationToUsers(
    ids,
    "📅 Cambio de Fecha Límite",
    `La tarea "${tarea.tarea}" ahora vence el ${fechaFormat}. Motivo: ${motivo || 'Ajuste de cronograma'}.`,
    `/mis-tareas`
  );
  
  // --- LOG BITÁCORA (Con Departamento) ---
  await registrarBitacora(
    "ACTUALIZAR_TAREA",
    `${user.nombre} cambió la fecha límite de "${tarea.tarea}" al ${fechaFormat}. Motivo: ${motivo}`,
    user.id,
    { 
        tareaId, 
        departamento: tarea.departamento.nombre, // <--- AHORA SÍ APARECERÁ
        fechaAnterior, 
        nuevaFecha, 
        motivo 
    }
  );
  // --------------------

  res.status(201).json(nuevoHistorial);
});