import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema } from "../schemas/tarea.schema.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js";
import { uploadImageBuffer } from "../../../utils/cloudinaryUtils.js";
import { registrarBitacora } from "../../../services/logger.service.js";

export const entregarTarea = safeAsync(async (req: Request, res: Response) => {
  const { id: tareaId } = paramsSchema.parse(req.params);
  const user = req.user!;

  // 1. Buscamos la tarea y sus relaciones necesarias
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: { 
        responsables: { select: { usuarioId: true } },
        departamento: { select: { nombre: true } } 
    },
  });

  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  // 2. Validación de Permisos: Solo el responsable o un Super Admin pueden entregar
  const esResponsable = tarea.responsables.some((r) => r.usuarioId === user.id);
  if (!esResponsable && user.rol !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "No tienes permiso para entregar esta tarea." });
  }

  // 3. Validación de Estatus: Solo se puede entregar si está PENDIENTE
  // (Si fue rechazada antes, volvió a ser PENDIENTE, así que esto funciona perfecto)
  if (tarea.estatus !== "PENDIENTE") {
    return res.status(400).json({ error: `No se puede entregar. Estatus actual: ${tarea.estatus}` });
  }

  // 4. Procesamiento de Imágenes (Si se subieron archivos)
  let imagenesData: any[] = [];
  const files = req.files as Express.Multer.File[]; 

  if (files && files.length > 0) {
    // Subimos todo a Cloudinary en paralelo
    const promesasSubida = files.map(file => 
      uploadImageBuffer(file.buffer, "tareas-calidad")
    );

    const resultados = await Promise.all(promesasSubida);

    imagenesData = resultados.map(result => ({
      url: result.secure_url,
      tareaId: tareaId,
    }));
  }

  const comentario = req.body.comentarioEntrega || "Tarea marcada como entregada.";

  // 5. Transacción en Base de Datos
  // Aquí ocurre lo importante: FECHA DE ENTREGA = AHORA
  const tareaActualizada = await prisma.$transaction(async (tx) => {
    // a) Guardar registro de las imágenes
    if (imagenesData.length > 0) {
      await tx.imagenTarea.createMany({ data: imagenesData });
    }
    
    // b) Actualizar la tarea
    return await tx.tarea.update({
      where: { id: tareaId },
      data: {
        estatus: "EN_REVISION",
        fechaEntrega: new Date(), // <--- ESTA ES LA VERDAD OPERATIVA (Se detiene el reloj del usuario)
        comentarioEntrega: comentario,
      },
      include: {
        responsables: { select: { usuario: { select: { id: true, nombre: true, rol: true } } } },
        imagenes: true
      }
    });
  });

  // 6. Notificar al Asignador (Jefe)
  if (tarea.asignadorId) {
    sendNotificationToUsers(
        [tarea.asignadorId], 
        `Tarea Entregada 📩`, 
        `${user.nombre} entregó evidencias: "${tarea.tarea}".`, 
        `/admin`
    );
  }

  // 7. Registro en Bitácora (Auditoría)
  await registrarBitacora(
    "CAMBIO_ESTATUS",
    `${user.nombre} marcó como ENTREGADA la tarea "${tarea.tarea}". Esperando revisión.`,
    user.id,
    { 
        tareaId, 
        departamento: tarea.departamento.nombre,
        evidencias: imagenesData.length, 
        comentario 
    }
  );

  res.json({ message: "Enviada a revisión", tarea: tareaActualizada });
});