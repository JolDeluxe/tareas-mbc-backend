import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js"; 
import { getPublicIdFromCloudinaryUrl, deleteImage } from "../../../utils/cloudinaryUtils.js";
import { paramsSchema } from "../schemas/tarea.schema.js";
import { registrarBitacora } from "../../../services/logger.service.js"; // <--- NUEVO

export const eliminarImagen = safeAsync(async (req: Request, res: Response) => {
  const { id } = paramsSchema.parse(req.params);
  const imagenId = Number(id);
  const user = req.user!;

  // MODIFICADO: Incluimos Tarea y Departamento para validar y loguear
  const imagen = await prisma.imagenTarea.findUnique({
    where: { id: imagenId },
    include: { 
        tarea: { 
            include: { departamento: { select: { nombre: true } } } 
        } 
    },
  });

  if (!imagen) return res.status(404).json({ error: "Imagen no encontrada" });

  // Permisos
  const { tarea } = imagen;
  const esSuperAdmin = user.rol === "SUPER_ADMIN";
  const esAdminDepto = user.rol === "ADMIN" && tarea.departamentoId === user.departamentoId;
  const esEncargadoAsignador = user.rol === "ENCARGADO" && tarea.asignadorId === user.id;

  if (!esSuperAdmin && !esAdminDepto && !esEncargadoAsignador) {
    return res.status(403).json({ error: "No tienes permiso para borrar esta imagen." });
  }

  // --- BORRADO ---
  const publicId = getPublicIdFromCloudinaryUrl(imagen.url, "tareas-calidad"); 
  let cloudinaryStatus = "OK";

  if (publicId) {
    await deleteImage(publicId).catch(err => {
        console.error("Error borrando en Cloudinary:", err);
        cloudinaryStatus = "ERROR_CLOUDINARY"; // Registramos si falló en la nube
    });
  } else {
    console.warn("No se pudo extraer el Public ID de la URL:", imagen.url);
    cloudinaryStatus = "ID_NO_ENCONTRADO";
  }

  // Borrar de BD
  await prisma.imagenTarea.delete({ where: { id: imagenId } });
  
  // --- LOG DE BITÁCORA ---
  await registrarBitacora(
    "ACTUALIZAR_TAREA",
    `${user.nombre} eliminó una imagen de la tarea "${tarea.tarea}".`,
    user.id,
    { 
        tareaId: tarea.id,
        departamento: tarea.departamento.nombre,
        imagenId: imagenId,
        urlEliminada: imagen.url,
        estadoNube: cloudinaryStatus
    }
  );
  // -----------------------

  res.json({ message: "Imagen eliminada correctamente" });
});