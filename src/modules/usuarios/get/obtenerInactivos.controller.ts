import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { querySchema } from "../schemas/usuario.schema.js";

export const obtenerInactivos = safeAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

  // 1. Validación de inputs
  // Usamos el mismo schema robusto que ya acepta page, limit, q, rol, etc.
  const queryParseResult = querySchema.safeParse(req.query);
  if (!queryParseResult.success) {
    return res.status(400).json({
      error: "Filtros inválidos",
      detalles: queryParseResult.error.flatten().fieldErrors,
    });
  }

  const { departamentoId, rol, q, page, limit } = queryParseResult.data;

  // Cálculo de paginación
  const pageNum = Math.max(1, page);
  const limitNum = Math.max(1, limit);
  const offset = (pageNum - 1) * limitNum;

  // 2. Construcción del Filtro Base (WHERE)
  // 🔒 FORZAMOS que solo busque INACTIVOS
  const where: Prisma.UsuarioWhereInput = {
    estatus: "INACTIVO",
  };

  // 3. Filtro de Búsqueda (Buscador general por nombre o username)
  if (q) {
    where.OR = [
      { nombre: { contains: q } },
      { username: { contains: q } },
    ];
  }

  // 4. Filtro de Rol específico
  if (rol) {
    where.rol = rol;
  }

  // 5. LÓGICA DE SEGURIDAD (Permisos de visualización para Inactivos)
  switch (user.rol) {
    case "SUPER_ADMIN":
      // Ve todo. Si manda departamentoId, filtra por eso.
      if (departamentoId) where.departamentoId = departamentoId;
      break;

    case "ADMIN":
    case "ENCARGADO": 
      // Admin y Encargado pueden ver el historial de bajas de SU departamento
      if (!user.departamentoId) return res.status(403).json({ error: "Usuario sin departamento asignado." });
      where.departamentoId = user.departamentoId;
      break;

    case "USUARIO":
    case "INVITADO":
      // Usuarios operativos NO deben tener acceso a la "papelera"
      return res.status(403).json({ error: "No tienes permisos para ver usuarios inactivos." });
  }

  // 6. Ejecución Transaccional (Eficiencia: 3 consultas en 1)
  const [total, usuarios, conteoPorRol] = await prisma.$transaction([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where,
      take: limitNum,
      skip: offset,
      select: {
        id: true,
        nombre: true,
        username: true,
        rol: true,
        estatus: true,
        fechaCreacion: true,
        fechaEdicion: true, // Importante para saber cuándo se desactivó
        departamentoId: true,
        departamento: { select: { id: true, nombre: true } },
      },
      orderBy: { fechaEdicion: "desc" }, // Ordenamos por el cambio más reciente (los últimos desactivados primero)
    }),
    prisma.usuario.groupBy({
      by: ["rol"],
      where: where,
      _count: {
        rol: true,
      },
      orderBy: {
        rol: 'asc',
      }
    }),
  ]);

  // 7. Formateo de métricas (Resumen por roles)
  const resumenRoles = (conteoPorRol as any[]).reduce((acc, curr) => {
    const count = curr._count?.rol ?? 0;
    acc[curr.rol] = count;
    return acc;
  }, {} as Record<string, number>);

  // 8. Respuesta
  res.json({
    status: "success",
    meta: {
      totalItems: total,
      itemsPorPagina: limitNum,
      paginaActual: pageNum,
      totalPaginas: Math.ceil(total / limitNum),
      resumenRoles,
    },
    data: usuarios,
  });
});