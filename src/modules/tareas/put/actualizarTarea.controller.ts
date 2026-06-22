import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema, actualizarTareaSchema } from "../schemas/tarea.schema.js";
import { tareaConRelacionesInclude } from "../helpers/prisma.constants.js";
import { sendNotificationToUsers } from "../helpers/notificaciones.helper.js";
import { registrarBitacora } from "../../../services/logger.service.js"; 
// 👇 Importamos las reglas de negocio
import { BUSINESS_RULES } from "../../../config/businessRules.js";
import { puedeEditarTarea } from "../helpers/permisosTareas.helper.js";

export const actualizarTarea = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar ID y Body
  const paramsParse = paramsSchema.safeParse(req.params);
  if (!paramsParse.success) return res.status(400).json({ error: "ID inválido" });
  
  const bodyParse = actualizarTareaSchema.safeParse(req.body);
  if (!bodyParse.success) return res.status(400).json({ error: "Datos inválidos", detalles: bodyParse.error.flatten().fieldErrors });

  const { id: tareaId } = paramsParse.data;
  const validatedBody = bodyParse.data;
  const user = req.user!;

  // 2. Obtener tarea actual
  const tareaExistente = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: {
      responsables: { select: { usuarioId: true } },
      asignador: { select: { id: true, rol: true, departamentoId: true } },
      departamento: { select: { nombre: true } } // Obtenemos Depto
    },
  });

  if (!tareaExistente) return res.status(404).json({ error: "Tarea no encontrada" });

  // 3. --- INMUTABILIDAD (El Candado) ---
  if (tareaExistente.estatus === "CONCLUIDA" || tareaExistente.estatus === "CANCELADA") {
    return res.status(400).json({ 
        error: `No se puede modificar una tarea con estatus ${tareaExistente.estatus}.` 
    });
  }

  // 4. Permisos Generales
  // En tareas externas, edita el departamento origen; el destino no puede modificarla.
  const puedeEditar = puedeEditarTarea(tareaExistente, user);

  if (!puedeEditar) {
    return res.status(403).json({ error: "No tienes permiso para editar esta tarea." });
  }

  // 5. Preparar actualización
  const { fechaLimite, responsables, ...restoDelBody } = validatedBody;
  
  const dataParaActualizar: any = { ...restoDelBody };
  delete dataParaActualizar.departamentoId; // Por seguridad

  // --- MANEJO DE FECHA LÍMITE (11:59:59 PM) ---
  if (fechaLimite) {
    const nuevaFecha = new Date(fechaLimite);
    if (nuevaFecha.getHours() === 0 && nuevaFecha.getMinutes() === 0) {
        nuevaFecha.setHours(23, 59, 59, 999);
    }
    dataParaActualizar.fechaLimite = nuevaFecha;
  }
  // ---------------------------------------------

  // Cambio de Estatus
  if (validatedBody.estatus) {
    if (validatedBody.estatus === "CONCLUIDA") {
      dataParaActualizar.fechaConclusion = new Date();
    } else {
      dataParaActualizar.fechaConclusion = null;
    }
  }

  // Cambio de Departamento (Solo Super Admin)
  if (validatedBody.departamentoId) {
    const esSuperAdmin = user.rol === "SUPER_ADMIN";
    if (!esSuperAdmin) return res.status(403).json({ error: "Solo Super Admin cambia departamento." });
    dataParaActualizar.departamento = { connect: { id: validatedBody.departamentoId } };
  }

  // Cambio de Responsables (Lógica para transacción con REGLA DE PIELES)
  let nuevosResponsablesIds: number[] = [];
  if (responsables) {
    // ---- NUEVA VALIDACIÓN DE JERARQUÍA ----
    const deptIdAUsar = validatedBody.departamentoId || tareaExistente.departamentoId;
    
    const usuariosResponsables = await prisma.usuario.findMany({
      where: { id: { in: responsables }, estatus: "ACTIVO" },
      select: { id: true, rol: true, departamentoId: true, nombre: true }, 
    });

    if (usuariosResponsables.length !== responsables.length) {
      return res.status(400).json({ error: "Uno o más responsables no existen o están inactivos." });
    }

    const departamentoAsignado = await prisma.departamento.findUnique({
      where: { id: deptIdAUsar },
      select: { nombre: true }
    });

    const esAsignacionEspecial = departamentoAsignado 
      ? BUSINESS_RULES.departamentosAsignacionJerarquiaLibre.includes(departamentoAsignado.nombre)
      : false;

    const esTareaExterna = deptIdAUsar !== user.departamentoId;

    for (const responsable of usuariosResponsables) {
      let valido = false;
      if (user.rol === "SUPER_ADMIN") {
        valido = true;
      } else if (esTareaExterna) {
        // 🔹 TAREA EXTERNA: ADMIN/ENCARGADO pueden asignar a cualquier rol activo del depto destino
        valido = responsable.departamentoId === deptIdAUsar 
                  && ["ADMIN", "ENCARGADO", "USUARIO"].includes(responsable.rol);
      } else if (user.rol === "ADMIN") {
        const rolesPermitidos = esAsignacionEspecial ? ["ADMIN", "ENCARGADO", "USUARIO"] : ["ENCARGADO", "USUARIO"];
        valido = (responsable.departamentoId === deptIdAUsar && rolesPermitidos.includes(responsable.rol));
      } else if (user.rol === "ENCARGADO") {
        const rolesPermitidos = esAsignacionEspecial ? ["ADMIN", "ENCARGADO", "USUARIO"] : ["ENCARGADO", "USUARIO"];
        valido = (responsable.departamentoId === deptIdAUsar && rolesPermitidos.includes(responsable.rol));
      }

      if (!valido) {
        return res.status(403).json({ 
          error: `No puedes asignar al usuario "${responsable.nombre}" (${responsable.rol}) en este contexto.` 
        });
      }
    }
    // ------------------------------------------------

    nuevosResponsablesIds = responsables; // Guardamos para usar en notificaciones
    dataParaActualizar.responsables = {
      deleteMany: {},
      create: responsables.map((uid) => ({ usuario: { connect: { id: uid } } })),
    };
  }

  // 7. Ejecutar Update
  const tareaActualizada = await prisma.tarea.update({
    where: { id: tareaId },
    data: dataParaActualizar,
    include: tareaConRelacionesInclude,
  });

  // 8. Notificaciones y Logs
  // A. Si se asignaron NUEVOS responsables
  if (nuevosResponsablesIds.length > 0) {
     sendNotificationToUsers(
        nuevosResponsablesIds, 
        "🆕 Nueva Tarea Asignada", 
        `Se te ha asignado la tarea: "${tareaActualizada.tarea}".`,
        `/tarea/${tareaId}`
     );

     await registrarBitacora(
       "ACTUALIZAR_TAREA",
       `${user.nombre} re-asignó responsables en la tarea "${tareaActualizada.tarea}".`,
       user.id,
       { 
           tareaId, 
           departamento: tareaExistente.departamento.nombre,
           nuevosResponsables: nuevosResponsablesIds 
       }
     );
  }

  // B. Notificar cambio de estatus
  if (validatedBody.estatus && validatedBody.estatus !== tareaExistente.estatus) {
    const ids = tareaActualizada.responsables.map(r => r.usuario.id);
    
    const idsAFiltrar = nuevosResponsablesIds.length > 0 
        ? ids.filter(id => !nuevosResponsablesIds.includes(id)) 
        : ids;

    if (idsAFiltrar.length > 0) {
      const titulo = validatedBody.estatus === "CONCLUIDA" ? "Tarea Concluida" : "Tarea Actualizada";
      sendNotificationToUsers(idsAFiltrar, titulo, `La tarea "${tareaActualizada.tarea}" ahora está ${validatedBody.estatus}`, "/mis-tareas");
    }

    await registrarBitacora(
       "CAMBIO_ESTATUS",
       `${user.nombre} cambió el estatus de "${tareaActualizada.tarea}" a ${validatedBody.estatus}.`,
       user.id,
       { 
           tareaId, 
           departamento: tareaExistente.departamento.nombre,
           anterior: tareaExistente.estatus, 
           nuevo: validatedBody.estatus 
       }
     );
  } else if (!nuevosResponsablesIds.length && !validatedBody.estatus) {
      // Log genérico de edición (si solo cambió texto o fechas sin cambiar estatus/responsables)
      await registrarBitacora(
        "ACTUALIZAR_TAREA",
        `${user.nombre} actualizó la tarea "${tareaActualizada.tarea}".`,
        user.id,
        { tareaId: tareaActualizada.id }
      );
  }

  res.json({ ...tareaActualizada, responsables: tareaActualizada.responsables.map(r => r.usuario) });
});
