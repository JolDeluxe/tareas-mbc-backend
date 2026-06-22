import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js"; // Ajusta la ruta si es necesario
import { safeAsync } from "../../../utils/safeAsync.js"; // Ajusta la ruta si es necesario

export const obtenerTodos = safeAsync(async (req: Request, res: Response) => {
  const departamentos = await prisma.departamento.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      tareasExternasHabilitadas: true,
      fechaCreacion: true,
      _count: {
        select: { usuarios: true, tareas: true }
      },
      usuarios: {
        select: { 
            id: true, 
            nombre: true, 
            rol: true 
        }
      }
    },
  });
  res.json(departamentos);
});