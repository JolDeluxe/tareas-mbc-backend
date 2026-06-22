import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { querySchema } from "../schemas/usuario.schema.js";

export const obtenerInvitados = safeAsync(async (req: Request, res: Response) => {
  const queryParseResult = querySchema.safeParse(req.query);
  if (!queryParseResult.success) {
    return res.status(400).json({
      error: "Query param inválido",
      detalles: queryParseResult.error.flatten().fieldErrors,
    });
  }

  const { estatus } = queryParseResult.data;
  const where: any = { rol: "INVITADO", estatus: estatus ?? "ACTIVO" };

  const usuariosInvitados = await prisma.usuario.findMany({
    where: where,
    select: {
      id: true, nombre: true, username: true, rol: true, estatus: true, fechaCreacion: true,
      departamento: { select: { id: true, nombre: true } },
    },
    orderBy: { nombre: "asc" },
  });

  res.json(usuariosInvitados);
});