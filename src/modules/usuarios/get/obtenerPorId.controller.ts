import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { identifierSchema } from "../schemas/usuario.schema.js"; // 👈 Importamos el nuevo schema

export const obtenerPorId = safeAsync(async (req: Request, res: Response) => {
  // 1. Validación Flexible (Acepta string o número como string)
  const paramsParseResult = identifierSchema.safeParse(req.params);
  if (!paramsParseResult.success) {
    return res.status(400).json({
      error: "Identificador inválido",
      detalles: paramsParseResult.error.flatten().fieldErrors,
    });
  }

  const { id: inputIdentifier } = paramsParseResult.data;
  const requester = req.user;
  
  if (!requester) return res.status(401).json({ error: "Usuario no autenticado" });

  // 2. Determinamos si buscamos por ID o por Texto (Username/Nombre)
  const isNumericId = /^\d+$/.test(inputIdentifier); // Regex: Solo dígitos
  
  // 3. Construcción del Filtro de Búsqueda (Search Logic)
  // Base: El usuario debe estar ACTIVO
  const searchWhere: Prisma.UsuarioWhereInput = {
    estatus: "ACTIVO",
  };

  if (isNumericId) {
    // Si es número, buscamos exactamente por ID
    searchWhere.id = parseInt(inputIdentifier, 10);
  } else {
    // Si es texto, buscamos por Username O Nombre (insensible a mayúsculas/minúsculas si la BD lo soporta, o exacto)
    searchWhere.OR = [
      { username: inputIdentifier },
      { nombre: { contains: inputIdentifier } } // 'contains' es más flexible para nombres
    ];
  }

  // 4. LÓGICA DE SEGURIDAD (Security Filters)
  // Restringimos la búsqueda base según lo que el rol solicitante tiene permitido ver.
  const securityClauses: Prisma.UsuarioWhereInput[] = [];

  // Si el usuario busca sus propios datos (ya sea por su ID o su Username), permitimos el acceso directo.
  // Nota: Verificamos contra ID numérico y username del token.
  const isSelfRequest = 
    (isNumericId && parseInt(inputIdentifier) === requester.id) || 
    (inputIdentifier === requester.username);

  if (!isSelfRequest) {
    switch (requester.rol) {
      case "SUPER_ADMIN":
        // Ve todo, no agregamos restricciones
        break;

      case "ADMIN":
        if (!requester.departamentoId) return res.status(403).json({ error: "Usuario sin departamento." });
        // Ve a su departamento O a invitados globales
        securityClauses.push({
          OR: [
            { departamentoId: requester.departamentoId },
            { rol: "INVITADO" }
          ]
        });
        break;

      case "ENCARGADO":
        if (!requester.departamentoId) return res.status(403).json({ error: "Usuario sin departamento." });
        // Ve a USUARIOS/ENCARGADOS de su depto O INVITADOS
        securityClauses.push({
          OR: [
            { 
              AND: [
                { departamentoId: requester.departamentoId },
                { rol: { in: ["USUARIO", "ENCARGADO", "ADMIN"] } } // Incluimos ADMIN para que pueda ver a su jefe
              ] 
            },
            { rol: "INVITADO" }
          ]
        });
        break;

      case "USUARIO":
        if (!requester.departamentoId) return res.status(403).json({ error: "Usuario sin departamento." });
        // Solo ve gente de su departamento (para asignación o consulta simple)
        securityClauses.push({
          departamentoId: requester.departamentoId,
          rol: { not: "SUPER_ADMIN" } // Opcional: Ocultar super admins
        });
        break;

      case "INVITADO":
        // Un invitado solo puede verse a sí mismo. 
        // Como ya validamos !isSelfRequest arriba, si entra aquí es un error de acceso.
        return res.status(403).json({ error: "No tienes permisos para ver otros perfiles." });

      default:
        return res.status(403).json({ error: "Rol no reconocido." });
    }
  }

  // 5. Fusión de filtros (Búsqueda + Seguridad)
  const finalWhere: Prisma.UsuarioWhereInput = {
    AND: [
      searchWhere,
      ...securityClauses
    ]
  };

  // 6. Ejecución
  const usuario = await prisma.usuario.findFirst({
    where: finalWhere,
    select: {
      id: true,
      nombre: true,
      username: true,
      rol: true,
      estatus: true,
      fechaCreacion: true,
      fechaEdicion: true,
      departamento: {
        select: { id: true, nombre: true }
      },
    },
  });

  if (!usuario) {
    return res.status(404).json({ 
      error: "Usuario no encontrado",
      message: "No se encontró un usuario activo con ese criterio o no tienes permisos para verlo."
    });
  }

  res.json(usuario);
});