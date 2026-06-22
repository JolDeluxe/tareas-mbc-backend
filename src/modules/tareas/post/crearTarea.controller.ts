import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { crearTareaSchema } from "../schemas/tarea.schema.js"; 
import { tareaConRelacionesInclude } from "../helpers/prisma.constants.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js";
import { registrarBitacora } from "../../../services/logger.service.js"; 
// 👇 Importamos las reglas de negocio
import { BUSINESS_RULES } from "../../../config/businessRules.js";

export const crearTarea = safeAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  
  // 1. Validar Body con Zod
  const bodyParse = crearTareaSchema.safeParse(req.body);
  if (!bodyParse.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: bodyParse.error.flatten().fieldErrors,
    });
  }

  const { departamentoId, responsables, observaciones, ...data } = bodyParse.data;

  // 2. Reglas de Negocio (Permisos de asignación)
  const esTareaExterna = departamentoId !== user.departamentoId;

  if (esTareaExterna && user.rol !== "SUPER_ADMIN") {
    if (!user.departamentoId) {
      return res.status(403).json({ error: "No tienes departamento asignado." });
    }

    const departamentoAsignador = await prisma.departamento.findUnique({
      where: { id: user.departamentoId },
      select: { nombre: true, tareasExternasHabilitadas: true }
    });

    if (!departamentoAsignador?.tareasExternasHabilitadas) {
      return res.status(403).json({ 
        error: "Tu departamento no tiene habilitada la asignación de tareas externas." 
      });
    }
  }

  // Verificar existencia de responsables
  const usuariosResponsables = await prisma.usuario.findMany({
    where: { id: { in: responsables }, estatus: "ACTIVO" },
    select: { id: true, rol: true, departamentoId: true, nombre: true }, 
  });

  if (usuariosResponsables.length !== responsables.length) {
    return res.status(400).json({ error: "Uno o más responsables no existen o están inactivos." });
  }

  // Obtener info del departamento DESTINO
  const departamentoDestino = await prisma.departamento.findUnique({
    where: { id: departamentoId },
    select: { nombre: true, tareasExternasHabilitadas: true }
  });

  if (!departamentoDestino) {
    return res.status(400).json({ error: "Departamento destino no encontrado." });
  }

  const esAsignacionEspecial = BUSINESS_RULES.departamentosAsignacionJerarquiaLibre.includes(departamentoDestino.nombre);

  // Validación jerárquica actualizada
  for (const responsable of usuariosResponsables) {
    let valido = false;

    if (user.rol === "SUPER_ADMIN") {
      valido = true;
    } else if (esTareaExterna) {
      // 🔹 TAREA EXTERNA: ADMIN/ENCARGADO pueden asignar a cualquier rol activo del depto destino
      valido = responsable.departamentoId === departamentoId 
                && ["ADMIN", "ENCARGADO", "USUARIO"].includes(responsable.rol);
    } else if (user.rol === "ADMIN") {
      // 🔹 TAREA INTERNA NORMAL
      const rolesPermitidos = esAsignacionEspecial 
        ? ["ADMIN", "ENCARGADO", "USUARIO"]
        : ["ENCARGADO", "USUARIO"];
      valido = (responsable.departamentoId === user.departamentoId && rolesPermitidos.includes(responsable.rol));
    } else if (user.rol === "ENCARGADO") {
      const rolesPermitidos = esAsignacionEspecial 
        ? ["ADMIN", "ENCARGADO", "USUARIO"]
        : ["ENCARGADO", "USUARIO"];
      valido = (responsable.departamentoId === user.departamentoId && rolesPermitidos.includes(responsable.rol));
    }

    if (!valido) {
      return res.status(403).json({ 
        error: `No puedes asignar al usuario "${responsable.nombre}" (${responsable.rol}) en este contexto.` 
      });
    }
  }

  // 3. --- LÓGICA DE TIEMPO (11:59:59 PM) ---
  const fechaLimiteFinal = new Date(data.fechaLimite);
  if (fechaLimiteFinal.getHours() === 0 && fechaLimiteFinal.getMinutes() === 0) {
      fechaLimiteFinal.setHours(23, 59, 59, 999);
  }

  // 4. Crear en BD
  const nuevaTarea = await prisma.tarea.create({
    data: {
      ...data,
      fechaLimite: fechaLimiteFinal,
      observaciones: observaciones ?? null,
      fechaRegistro: new Date(),
      asignador: { connect: { id: user.id } },
      departamento: { connect: { id: departamentoId } },
      responsables: {
        create: responsables.map((id) => ({ usuario: { connect: { id } } })),
      },
    },
    include: {
        ...tareaConRelacionesInclude,
        departamento: { select: { nombre: true } }
    },
  });

  // 5. Notificar
  sendNotificationToUsers(
    responsables,
    `Nueva Tarea: ${nuevaTarea.tarea}`,
    `Asignada por ${user.nombre}`,
    `/admin`
  );

  // --- LOG DE BITÁCORA ---
  const nombresAsignados = usuariosResponsables.map(u => u.nombre).join(", ");
  await registrarBitacora(
    "CREAR_TAREA",
    `${user.nombre} creó la tarea "${nuevaTarea.tarea}" y la asignó a: ${nombresAsignados}.`,
    user.id,
    { tareaId: nuevaTarea.id, departamento: nuevaTarea.departamento.nombre, responsablesIds: responsables }
  );

  // 6. Respuesta limpia
  const tareaLimpia = {
    ...nuevaTarea,
    responsables: nuevaTarea.responsables.map((r) => r.usuario),
  };

  res.status(201).json(tareaLimpia);
});