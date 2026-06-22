import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js"; 
import { paramsSchema } from "../schemas/tarea.schema.js";
import { uploadImageBuffer } from "../../../utils/cloudinaryUtils.js"; 
import { registrarBitacora } from "../../../services/logger.service.js"; // <--- NUEVO

export const subirImagen = safeAsync(async (req: Request, res: Response) => {
  const { id } = paramsSchema.parse(req.params);
  const tareaId = Number(id);
  const user = req.user!;

  // MODIFICADO: Incluimos departamento para el log
  const tarea = await prisma.tarea.findUnique({ 
    where: { id: tareaId },
    include: { departamento: { select: { nombre: true } } } 
  });

  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  // Permisos básicos
  const permitido = 
    user.rol === "SUPER_ADMIN" || 
    (tarea.departamentoId === user.departamentoId && ["ADMIN", "ENCARGADO"].includes(user.rol));

  if (!permitido) return res.status(403).json({ error: "No puedes subir imágenes aquí." });

  // Validación de archivos
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No hay archivos para subir" });
  }

  // --- OPTIMIZACIÓN Y SUBIDA ---
  const promesasDeSubida = files.map(file => 
    uploadImageBuffer(file.buffer, "tareas-calidad") 
  );

  // Si Cloudinary falla, safeAsync atrapará el error aquí
  const resultados = await Promise.all(promesasDeSubida);

  // Preparamos los datos para Prisma
  const imagenesData = resultados.map(result => ({
    url: result.secure_url,
    tareaId: tareaId,
  }));

  // Guardamos en Base de Datos
  const resultadoBD = await prisma.imagenTarea.createMany({ data: imagenesData });
  
  // --- LOG DE BITÁCORA ---
  await registrarBitacora(
    "ACTUALIZAR_TAREA",
    `${user.nombre} subió ${resultadoBD.count} imagen(es) a la tarea "${tarea.tarea}".`,
    user.id,
    { 
        tareaId, 
        departamento: tarea.departamento.nombre,
        imagenesSubidas: resultadoBD.count,
        urls: imagenesData.map(img => img.url) // Guardamos las URLs por seguridad
    }
  );
  // -----------------------

  res.status(201).json({
    message: "Imágenes optimizadas y subidas",
    count: resultadoBD.count,
    data: imagenesData
  });
});