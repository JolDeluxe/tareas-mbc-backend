import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { getTareasQuerySchema } from "../schemas/tarea.schema.js";
import { tareaConRelacionesInclude } from "../helpers/prisma.constants.js";

export const obtenerAsignadas = safeAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  
  const queryParse = getTareasQuerySchema.safeParse(req.query);
  if (!queryParse.success) return res.status(400).json({ error: "Filtros inválidos" });
  const { estatus } = queryParse.data;

  const where = {
    ...(estatus && { estatus }),
    asignadorId: user.id, // Filtro forzado
  };

  const [total, tareas] = await prisma.$transaction([
    prisma.tarea.count({ where }),
    prisma.tarea.findMany({
      where,
      include: tareaConRelacionesInclude,
      orderBy: { id: "desc" },
    }),
  ]);

  const tareasLimpio = tareas.map((t) => ({
    ...t,
    responsables: t.responsables.map((r) => r.usuario),
  }));

  res.json({ info: { total, count: tareas.length }, data: tareasLimpio });
});