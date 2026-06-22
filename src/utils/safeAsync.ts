import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

/**
 * Wrapper para manejar errores asíncronos en controladores de Express.
 * Elimina la necesidad de bloques try-catch repetitivos.
 */
export const safeAsync =
  (
    fn: (
      req: Request,
      res: Response,
      next: NextFunction
    ) => Promise<void | Response> | void
  ) =>
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> => {
    try {
      await fn(req, res, next);
    } catch (error: any) {
      // Log interno para el desarrollador
      console.error("❌ Error capturado por safeAsync:", error);

      // Manejo específico de errores de Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        
        // P2002: Violación de restricción única (ej. email ya registrado)
        if (error.code === "P2002") {
          // 🔑 FIX: Manejar cuando target es string o array para evitar TypeError
          const targetMeta = error.meta?.target;
          let target: string = "";

          if (Array.isArray(targetMeta)) {
            target = targetMeta.join(", ");
          } else if (typeof targetMeta === 'string') {
            target = targetMeta;
          } else {
            target = "campo(s) desconocido(s)";
          }

          // Manejo específico para el error de Suscripción Push
          if (target.includes('PushSubscription_endpoint_key')) {
            return res.status(409).json({
              error: "Conflicto de Suscripción",
              detalle: "Este dispositivo ya está registrado para recibir notificaciones push.",
            });
          }
          
          return res.status(409).json({
            error: "Conflicto de datos",
            detalle: `El campo **${target}** ya existe y debe ser único.`,
          });
        }

        // P2025: Registro no encontrado
        if (error.code === "P2025") {
          return res.status(404).json({ error: "Recurso no encontrado" });
        }
      }

      // Si la respuesta no se ha enviado aún, enviamos un 500 genérico
      if (!res.headersSent) {
        res.status(500).json({
          error: "Ocurrió un error inesperado en el servidor",
          detalle: error?.message ?? error,
        });
      }
    }
  };