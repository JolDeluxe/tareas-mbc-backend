import { prisma } from "../config/db.js";

// ✅ Agregamos "AUTO_VALIDACION" a los tipos permitidos
type TipoAccion = 
  | "LOGIN" 
  | "CREAR_TAREA" 
  | "ACTUALIZAR_TAREA" 
  | "CAMBIO_ESTATUS"
  | "NOTIFICACION" 
  | "ERROR_SISTEMA"
  | "AUTO_VALIDACION";

export const registrarBitacora = async (
  accion: TipoAccion,
  descripcion: string,
  usuarioId?: number | null,
  detalles?: object
) => {
  try {
    await prisma.bitacora.create({
      data: {
        accion,
        descripcion,
        usuarioId: usuarioId ?? null,
        detalles: detalles ?? {},
      },
    });
  } catch (error) {
    console.error("❌ Error guardando bitácora:", error);
    // No detenemos el flujo si falla el log
  }
};