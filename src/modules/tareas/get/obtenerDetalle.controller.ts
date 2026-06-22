import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema } from "../schemas/tarea.schema.js";
import { tareaDetalladaInclude } from "../helpers/prisma.constants.js";

export const obtenerDetalle = safeAsync(async (req: Request, res: Response) => {
  const { id: tareaId } = paramsSchema.parse(req.params);
  const user = req.user!;

  // 1. Buscamos la tarea con el include detallado (Historial, Imágenes, Responsables, Asignador, Depto)
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: tareaDetalladaInclude,
  });

  if (!tarea) return res.status(404).json({ error: "Tarea no encontrada" });

  // 2. Lógica de Visibilidad (Tu lógica original intacta)
  let puedeVer = false;

  if (user.rol === "SUPER_ADMIN") puedeVer = true;
  else if (user.rol === "ADMIN" || user.rol === "ENCARGADO") {
    if (tarea.departamentoId === user.departamentoId) puedeVer = true;
  } else {
    const esResponsable = tarea.responsables.some(r => r.usuario.id === user.id);
    if (esResponsable) puedeVer = true;
  }

  if (!puedeVer) {
    return res.status(403).json({ error: "No tienes permiso para ver esta tarea." });
  }

  // 3. --- ANÁLISIS DETALLADO DE TIEMPOS Y CUMPLIMIENTO ---
  const hoy = new Date();
  const limite = new Date(tarea.fechaLimite);
  
  // Determinamos la fecha de referencia para saber cuándo se cumplió o entregó
  const fechaReferenciaCumplimiento = tarea.fechaEntrega 
    ? new Date(tarea.fechaEntrega) 
    : (tarea.fechaConclusion ? new Date(tarea.fechaConclusion) : null);

  let estadoTiempo = "";
  let indicadorColor = ""; // Para facilitar badges en el frontend
  let diasDiferencia = 0;
  const unDiaMS = 1000 * 60 * 60 * 24;

  // Lógica avanzada de etiquetas
  if (tarea.estatus === "PENDIENTE") {
    diasDiferencia = Math.floor((limite.getTime() - hoy.getTime()) / unDiaMS);
    if (hoy > limite) {
      estadoTiempo = "RETRASO";
      indicadorColor = "text-red-600 font-bold";
    } else if (diasDiferencia <= 2) {
      estadoTiempo = "PRÓXIMO A VENCER";
      indicadorColor = "text-orange-500 font-bold";
    } else {
      estadoTiempo = "A TIEMPO";
      indicadorColor = "text-green-600";
    }
  } 
  else if (tarea.estatus === "EN_REVISION") {
    // Si ya entregó, comparamos la fecha de entrega contra el límite, no contra hoy.
    if (tarea.fechaEntrega && new Date(tarea.fechaEntrega) > limite) {
      estadoTiempo = "ENTREGADA CON RETRASO (EN REVISIÓN)";
      indicadorColor = "text-red-500";
      diasDiferencia = Math.floor((limite.getTime() - new Date(tarea.fechaEntrega).getTime()) / unDiaMS);
    } else {
      estadoTiempo = "ENTREGADA A TIEMPO (EN REVISIÓN)";
      indicadorColor = "text-blue-500";
      diasDiferencia = Math.floor((limite.getTime() - (tarea.fechaEntrega ? new Date(tarea.fechaEntrega).getTime() : hoy.getTime())) / unDiaMS);
    }
  }
  else if (tarea.estatus === "CONCLUIDA") {
    if (fechaReferenciaCumplimiento) {
      diasDiferencia = Math.floor((limite.getTime() - fechaReferenciaCumplimiento.getTime()) / unDiaMS);
      if (fechaReferenciaCumplimiento > limite) {
        estadoTiempo = "FINALIZADA CON RETRASO";
        indicadorColor = "text-red-700";
      } else {
        estadoTiempo = "FINALIZADA A TIEMPO";
        indicadorColor = "text-blue-700 font-bold";
      }
    } else {
      estadoTiempo = "CONCLUIDA";
      indicadorColor = "text-blue-600";
    }
  } else {
    estadoTiempo = "CANCELADA";
    indicadorColor = "text-gray-500 italic";
  }

  // 4. --- FORMATEO Y LIMPIEZA DE RESPUESTA ---
  const responsablesLimpio = tarea.responsables.map((r) => ({
    id: r.usuario.id,
    nombre: r.usuario.nombre,
    rol: r.usuario.rol,
    username: (r.usuario as any).username || null,
    departamentoId: (r.usuario as any).departamentoId || null
  }));

  const tareaFinal = {
    ...tarea,
    // Detalles extra de análisis de gestión de calidad
    analisis: {
      estadoTiempo,
      indicadorColor,
      diasDiferencia,
      esAtrasada: (fechaReferenciaCumplimiento || hoy) > limite,
      esEditable: tarea.estatus !== "CONCLUIDA" && tarea.estatus !== "CANCELADA",
      leyendaRetraso: (fechaReferenciaCumplimiento || hoy) > limite 
        ? `Desfase de ${Math.abs(diasDiferencia)} día(s)` 
        : `Tarea al día`
    },
    responsables: responsablesLimpio,
    asignador: {
      id: tarea.asignador.id,
      nombre: tarea.asignador.nombre,
      rol: tarea.asignador.rol,
      departamentoId: tarea.asignador.departamentoId
    }
  };

  res.json({
    status: "success",
    data: tareaFinal
  });
});