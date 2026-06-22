import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { deptoSchema } from "../schemas/departamento.schema.js";

export const crearDepartamento = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar el body
  const parseResult = deptoSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      detalles: parseResult.error.flatten().fieldErrors,
    });
  }

  const { nombre, tipo } = parseResult.data;

  // 2. Crear en la BD
  // 'safeAsync' se encargará de atrapar el error P2002 si el nombre ya existe
  const nuevoDepto = await prisma.departamento.create({
    data: {
      nombre,
      tipo,
    },
  });

  res.status(201).json(nuevoDepto);
});