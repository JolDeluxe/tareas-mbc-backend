import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema, actualizarUsuarioSchema } from "../schemas/usuario.schema.js";

export const actualizarUsuario = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar ID de URL
  const paramsParseResult = paramsSchema.safeParse(req.params);
  if (!paramsParseResult.success) {
    return res.status(400).json({
      error: "ID de URL inválido",
      detalles: paramsParseResult.error.flatten().fieldErrors,
    });
  }
  const { id } = paramsParseResult.data;

  // 2. Validar Body
  const bodyParseResult = actualizarUsuarioSchema.safeParse(req.body);
  if (!bodyParseResult.success) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      detalles: bodyParseResult.error.flatten().fieldErrors,
    });
  }
  
  // Clonamos los datos para manipularlos si es necesario
  const inputData = { ...bodyParseResult.data };
  const creador = req.user!;

  // 3. Buscar usuario actual
  const usuarioActual = await prisma.usuario.findUnique({ where: { id } });

  if (!usuarioActual) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  // =================================================================
  // 🛡️ LÓGICA DE SEGURIDAD (ADMIN vs OTROS)
  // =================================================================

  if (creador.rol === "ADMIN") {
    const esDeMiDepartamento = usuarioActual.departamentoId === creador.departamentoId;
    const esInvitado = usuarioActual.rol === "INVITADO";

    if (!esDeMiDepartamento && !esInvitado) {
        return res.status(403).json({ error: "No tienes permiso para editar usuarios de otro departamento." });
    }

    if (inputData.departamentoId && inputData.departamentoId !== creador.departamentoId) {
        return res.status(403).json({ error: "No puedes transferir usuarios a otro departamento." });
    }

    if (inputData.rol && inputData.rol !== usuarioActual.rol && ["SUPER_ADMIN", "ADMIN"].includes(inputData.rol)) {
      return res.status(403).json({ error: "No tienes privilegios para asignar roles administrativos de alto nivel." });
  }
  }

  // =================================================================

  if (usuarioActual.estatus === "INACTIVO" && inputData.estatus !== "ACTIVO") {
    return res.status(403).json({ error: "No se puede modificar un usuario inactivo. Reactívalo primero." });
  }

  // AUTO-CORRECCIONES LÓGICAS
  
  const rolFinal = inputData.rol ?? usuarioActual.rol;
  const deptoIdFinal = inputData.departamentoId !== undefined ? inputData.departamentoId : usuarioActual.departamentoId;

  // Caso 1: INVITADO o SUPER_ADMIN -> SIEMPRE SIN DEPARTAMENTO
  if (["SUPER_ADMIN", "INVITADO"].includes(rolFinal)) {
    if (deptoIdFinal !== null) {
       inputData.departamentoId = null; // Forzamos null aquí
    }
  }

  // Caso 2: Internos -> Requieren Departamento
  if (["ADMIN", "ENCARGADO", "USUARIO"].includes(rolFinal)) {
    if (deptoIdFinal === null) {
       if (creador.rol === "ADMIN" && creador.departamentoId) {
          inputData.departamentoId = creador.departamentoId;
       } else {
          return res.status(400).json({ error: "Conflicto de reglas", detalle: `El rol ${rolFinal} requiere un departamentoId válido.` });
       }
    }
  }

  if (inputData.estatus === "INACTIVO" && usuarioActual.estatus === "ACTIVO") {
    return res.status(400).json({ error: "Acción incorrecta", detalle: "Para desactivar un usuario, usa la ruta PUT /:id/estatus" });
  }

  // =================================================================
  // CONSTRUCCIÓN DEL OBJETO DE ACTUALIZACIÓN (SOLUCIÓN ERROR TS)
  // =================================================================
  
  // Paso 1: Creamos el objeto con solo lo obligatorio
  const dataParaActualizar: Prisma.UsuarioUpdateInput = { 
    fechaEdicion: new Date(),
  };

  // Paso 2: Asignamos propiedad por propiedad SOLO si existe.
  // Esto evita pasar 'undefined' y satisface a TypeScript estricto.
  
  if (inputData.nombre !== undefined) {
    dataParaActualizar.nombre = inputData.nombre;
  }
  
  if (inputData.username !== undefined) {
    dataParaActualizar.username = inputData.username;
  }
  
  if (inputData.rol !== undefined) {
    dataParaActualizar.rol = inputData.rol;
  }

  if (inputData.password) {
    dataParaActualizar.password = await bcrypt.hash(inputData.password, 10);
  }

  // Lógica de Departamento (Disconnect vs Connect)
  // Aquí es crucial: si es null desconectamos, si es numero conectamos.
  if (inputData.departamentoId !== undefined) {
    if (inputData.departamentoId === null) {
        dataParaActualizar.departamento = { disconnect: true };
    } else {
        dataParaActualizar.departamento = { connect: { id: inputData.departamentoId } };
    }
  }

  // Ejecutamos la actualización
  const usuarioActualizado = await prisma.usuario.update({
    where: { id },
    data: dataParaActualizar,
    select: {
      id: true, nombre: true, username: true, rol: true, estatus: true, departamentoId: true, fechaEdicion: true,
    },
  });

  res.json(usuarioActualizado);
});