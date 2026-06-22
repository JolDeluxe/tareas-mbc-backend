import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";

export const verify = safeAsync(async (req: Request, res: Response) => {
  const usuarioId = req.user?.id;
  
  if (!usuarioId) {
    return res.status(401).json({ error: "Token inválido sin ID" });
  }

  // Buscamos los datos más frescos del usuario
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nombre: true,
      username: true,
      rol: true,
      departamentoId: true,
      estatus: true,
      departamento: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  });

  if (!usuario) {
    return res.status(404).json({ error: "Usuario del token no encontrado" });
  }

  res.json({ valid: true, usuario: usuario });
});