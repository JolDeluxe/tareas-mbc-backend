import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema, actualizarDeptoSchema } from "../schemas/departamento.schema.js";

export const actualizarDepartamento = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar el ID
  const paramsParseResult = paramsSchema.safeParse(req.params);
  if (!paramsParseResult.success) {
    return res.status(400).json({
      error: "ID de URL inválido",
      detalles: paramsParseResult.error.flatten().fieldErrors,
    });
  }
  const { id } = paramsParseResult.data;

  // 2. Validar el body
  const bodyParseResult = actualizarDeptoSchema.safeParse(req.body);
  if (!bodyParseResult.success) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      detalles: bodyParseResult.error.flatten().fieldErrors,
    });
  }

  const validatedBody = bodyParseResult.data;

  // 3. Construir el objeto 'data' limpio para Prisma
  const dataParaActualizar: Prisma.DepartamentoUpdateInput = {
    fechaEdicion: new Date(),
    ...(validatedBody.nombre !== undefined && { nombre: validatedBody.nombre }),
    ...(validatedBody.tipo !== undefined && { tipo: validatedBody.tipo }),
    ...(validatedBody.tareasExternasHabilitadas !== undefined && {
      tareasExternasHabilitadas: validatedBody.tareasExternasHabilitadas,
    }),
  };

  // 4. Actualizar en la BD
  const deptoActualizado = await prisma.departamento.update({
    where: { id },
    data: dataParaActualizar,
  });

  res.json(deptoActualizado);
});