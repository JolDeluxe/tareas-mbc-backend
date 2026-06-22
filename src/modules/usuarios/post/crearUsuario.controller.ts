import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { crearUsuarioSchema } from "../schemas/usuario.schema.js";

export const crearUsuario = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar datos de entrada con Zod
  const parseResult = crearUsuarioSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      detalles: parseResult.error.flatten().fieldErrors,
    });
  }

  // 2. VALIDACIÓN DE DUPLICADOS (Username)
  const usuarioExistente = await prisma.usuario.findUnique({
    where: {
      username: parseResult.data.username
    }
  });

  if (usuarioExistente) {
    return res.status(409).json({ 
      error: "Conflicto de datos",
      detalles: {
        username: ["Este nombre de usuario ya está registrado."]
      }
    });
  }

  const { nombre, username, password, rol, departamentoId } = parseResult.data;
  const creador = req.user!; 

  // =================================================================
  // 🛡️ LÓGICA DE PERMISOS JERÁRQUICOS
  // =================================================================
  
  let finalDepartamentoId = departamentoId;

  // REGLAS PARA CREADOR "ADMIN"
  if (creador.rol === "ADMIN") {
    if (["SUPER_ADMIN", "ADMIN"].includes(rol)) {
      return res.status(403).json({ 
        error: "Permiso denegado", 
        message: "Como ADMIN solo puedes crear ENCARGADOS, USUARIOS o INVITADOS." 
      });
    }

    if (rol === "INVITADO") {
      finalDepartamentoId = null;
    } else {
      if (!creador.departamentoId) {
        return res.status(500).json({ error: "Error de integridad: Tu usuario ADMIN no tiene departamento." });
      }
      finalDepartamentoId = creador.departamentoId;
    }
  }

  // REGLAS PARA CREADOR "SUPER_ADMIN"
  if (creador.rol === "SUPER_ADMIN") {
    if (["ADMIN", "ENCARGADO", "USUARIO"].includes(rol) && !finalDepartamentoId) {
        return res.status(400).json({ 
          error: "Falta departamento", 
          message: `Para crear un ${rol} debes seleccionar un departamento.` 
        });
    }
    if (["INVITADO", "SUPER_ADMIN"].includes(rol)) {
        finalDepartamentoId = null;
    }
  }

  // =================================================================

  const hashedPassword = await bcrypt.hash(password, 10);

  // =================================================================
  // CONSTRUCCIÓN DEL OBJETO (ESTRATEGIA SEGURA - SIN SPREAD)
  // =================================================================
  
  // 1. Definimos los campos base obligatorios
  const dataParaCrear: Prisma.UsuarioCreateInput = {
    nombre,
    username,
    password: hashedPassword,
    rol,
    estatus: "ACTIVO",
  };

  // 2. Asignamos el departamento SOLO si existe un ID válido.
  // Esto evita pasar 'undefined' y elimina el error TS-2375 de raíz.
  if (finalDepartamentoId) {
    dataParaCrear.departamento = { connect: { id: finalDepartamentoId } };
  }

  const nuevoUsuario = await prisma.usuario.create({
    data: dataParaCrear,
    select: {
      id: true, 
      nombre: true, 
      username: true, 
      rol: true, 
      estatus: true, 
      departamento: { select: { id: true, nombre: true } }, 
      fechaCreacion: true,
    },
  });

  res.status(201).json(nuevoUsuario);
});