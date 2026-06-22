import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { querySchema } from "../schemas/usuario.schema.js";

export const obtenerEncargadosYUsuarios = safeAsync(async (req: Request, res: Response) => {
  const queryParseResult = querySchema.safeParse(req.query);
  if (!queryParseResult.success) {
    return res.status(400).json({
      error: "Query param inválido",
      detalles: queryParseResult.error.flatten().fieldErrors,
    });
  }

  const { estatus } = queryParseResult.data;
  const user = req.user!;

  const where: Prisma.UsuarioWhereInput = {
    rol: { in: ["ENCARGADO", "USUARIO"] },
    estatus: estatus ?? "ACTIVO",
  };

  if (user.rol !== "SUPER_ADMIN") {
    if (!user.departamentoId) return res.status(403).json({ error: "Tu usuario no está asignado a un departamento." });
    where.departamentoId = user.departamentoId;
  }

  const usuarios = await prisma.usuario.findMany({
    where: where,
    select: {
      id: true, nombre: true, username: true, rol: true, estatus: true, fechaCreacion: true,
      departamento: { select: { id: true, nombre: true } },
    },
    orderBy: { nombre: "asc" },
  });

  res.json(usuarios);
});