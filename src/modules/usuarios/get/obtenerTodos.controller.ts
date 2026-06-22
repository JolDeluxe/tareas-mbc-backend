import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { querySchema } from "../schemas/usuario.schema.js";

export const obtenerTodos = safeAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

  // 1. Validación de inputs con valores por defecto
  const queryParseResult = querySchema.safeParse(req.query);
  if (!queryParseResult.success) {
    return res.status(400).json({
      error: "Filtros inválidos",
      detalles: queryParseResult.error.flatten().fieldErrors,
    });
  }

  // Al tener el schema actualizado, TS ahora reconocerá estas propiedades
  const { departamentoId, estatus, rol, q, page, limit } = queryParseResult.data;
  console.log("🔍 [BACKEND OBTER TODOS] Query Params:", req.query);
  console.log("🔍 [BACKEND OBTER TODOS] Zod parsed:", queryParseResult.data);
  console.log("🔍 [BACKEND OBTER TODOS] User:", { id: user.id, rol: user.rol, departamentoId: user.departamentoId });

  const sortBy = req.query.sortBy as string || 'rolJerarquia';
  const sortDirection = req.query.sortDirection as string || 'asc';

  // Cálculo de paginación
  const pageNum = Math.max(1, page);
  const limitNum = Math.max(1, limit);
  const offset = (pageNum - 1) * limitNum;

  // =====================================================================
  // 2. CONSTRUCCIÓN DEL FILTRO BASE (Para los contadores globales)
  // =====================================================================
  const whereBase: Prisma.UsuarioWhereInput = {
    estatus: estatus ?? "ACTIVO",
  };
  console.log("🔍 [BACKEND OBTER TODOS] whereBase:", whereBase);

  // 3. Filtro de Búsqueda (Buscador general)
  if (q) {
    whereBase.OR = [
      { nombre: { contains: q } }, 
      { username: { contains: q } },
    ];
  }

  // 4. LÓGICA DE SEGURIDAD (Permisos de visualización aplicados a la base)
  switch (user.rol) {
    case "SUPER_ADMIN":
      if (departamentoId) whereBase.departamentoId = departamentoId;
      break;

    case "ADMIN":
      if (!user.departamentoId) return res.status(403).json({ error: "Usuario ADMIN sin departamento asignado." });
      whereBase.departamentoId = departamentoId ?? user.departamentoId;
      break;

    case "ENCARGADO":
      if (!user.departamentoId) return res.status(403).json({ error: "Usuario ENCARGADO sin departamento asignado." });
      whereBase.departamentoId = departamentoId ?? user.departamentoId;
      break;

    case "USUARIO":
    case "INVITADO":
      whereBase.id = user.id;
      break;
  }

  console.log("🔍 [BACKEND OBTER TODOS] Final whereBase after switch:", whereBase);

  // =====================================================================
  // 5. CONSTRUCCIÓN DEL FILTRO DE LISTA (Solo para la tabla de resultados)
  // =====================================================================
  // Clonamos las reglas base (seguridad, estatus y búsqueda)
  const whereList: Prisma.UsuarioWhereInput = { ...whereBase };
  console.log("🔍 [BACKEND OBTER TODOS] whereList:", whereList);

  // Aplicamos el filtro de Rol específico SOLO a la lista, no a los contadores
  // (A menos que sea Usuario/Invitado, que solo se ven a sí mismos)
  if (rol && !["USUARIO", "INVITADO"].includes(user.rol)) {
    whereList.rol 
    = rol;
  }

// let orderByPrisma: Prisma.UsuarioOrderByWithRelationInput | Prisma.UsuarioOrderByWithRelationInput[] = { id: "desc" };

//   if (sortBy) {
//     if (sortBy === "rolJerarquia") {
//       // Prisma ordenará según el orden de declaración en schema.prisma (SUPER_ADMIN, ADMIN, ENCARGADO, USUARIO...)
//       orderByPrisma = [
//         { rol: sortDirection === "asc" ? Prisma.SortOrder.asc : Prisma.SortOrder.desc },
//         { nombre: Prisma.SortOrder.asc } // Desempate alfabético secundario
//       ];
//     } 
//     else if (["nombre", "username", "estatus"].includes(sortBy)) {
//       // Ordenamiento estándar para strings
//       orderByPrisma = { [sortBy]: sortDirection === "asc" ? Prisma.SortOrder.asc : Prisma.SortOrder.desc };
//     }
//   }

  // 6. Ejecución Transaccional
  const [total, usuarios, conteoPorRol] = await prisma.$transaction([
    // ✅ Usamos whereBase para mantener el total global estático
    prisma.usuario.count({ where: whereBase }),
    
    // ✅ Usamos whereList para que la tabla sí reaccione a los clicks de los botones
prisma.usuario.findMany({
      where: whereList,
      take: limitNum,
      skip: offset,
      select: {
        id: true,
        nombre: true,
        username: true,
        rol: true,
        estatus: true,
        fechaCreacion: true,
        departamentoId: true,
        departamento: { select: { id: true, nombre: true } },
      },
      orderBy: { id: "desc" },
    }),
    
    // ✅ Usamos whereBase para que los números de las tarjetas no se pongan en 0
    prisma.usuario.groupBy({
      by: ["rol"],
      where: whereBase,
      _count: {
        rol: true,
      },
      // Agregamos orderBy para satisfacer tipos estrictos de Prisma en groupBy
      orderBy: {
        rol: 'asc',
      }
    }),
  ]);

  // 7. Formateo del "conteo por rol" para el frontend
  // Usamos 'as any[]' para romper la inferencia compleja de tupla de Prisma que causa el error 2339/18048
  const resumenRoles = (conteoPorRol as any[]).reduce((acc, curr) => {
    // Usamos optional chaining por seguridad
    const count = curr._count?.rol ?? 0;
    acc[curr.rol] = count;
    return acc;
  }, {} as Record<string, number>);

  // 8. Respuesta Robusta
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