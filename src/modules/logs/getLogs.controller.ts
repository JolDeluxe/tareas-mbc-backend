import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { safeAsync } from "../../utils/safeAsync.js";

export const getLogs = safeAsync(async (req: Request, res: Response) => {
  // Obtenemos los últimos 100 logs (puedes ajustar el número)
  const logs = await prisma.bitacora.findMany({
    orderBy: { fecha: 'desc' },
    take: 100, 
    include: {
      usuario: {
        select: { nombre: true, rol: true }
      }
    }
  });

  res.json(logs);
});