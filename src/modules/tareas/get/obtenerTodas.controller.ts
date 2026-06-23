import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { getTareasQuerySchema } from "../schemas/tarea.schema.js";
import { tareaConRelacionesInclude } from "../helpers/prisma.constants.js";
import { BUSINESS_RULES } from "../../../config/businessRules.js";

// Estructura para el desglose individual (por depto o usuario)
interface BreakdownMetrics {
  id: number | string;
  nombre: string;
  // Métricas de Tiempo
  pendientesAtrasadas: number;
  pendientesATiempo: number;
  entregadasAtrasadas: number;
  entregadasATiempo: number;
  // Métricas de Estatus (Nuevas agregadas)
  activas: number;
  pendientes: number;
  enRevision: number;
  concluidas: number;
  canceladas: number;
  // Total
  total: number;
}

// Inicializador de métricas vacías
const initBreakdown = (id: number | string, nombre: string): BreakdownMetrics => ({
  id,
  nombre,
  pendientesAtrasadas: 0,
  pendientesATiempo: 0,
  entregadasAtrasadas: 0,
  entregadasATiempo: 0,
  activas: 0,
  pendientes: 0,
  enRevision: 0,
  concluidas: 0,
  canceladas: 0,
  total: 0,
});

export const obtenerTodas = safeAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

  // 1. Validar Query Params con Zod
  const queryParse = getTareasQuerySchema.safeParse(req.query);
  if (!queryParse.success) {
    return res.status(400).json({
      error: "Filtros inválidos",
      detalles: queryParse.error.flatten().fieldErrors,
    });
  }

  const {
    departamentoId,
    asignadorId,
    responsableId,
    estatus,
    urgencia, // ✅ Urgencia
    tiempoFilter,
    viewType,
    page = 1,
    limit = 30,
    query,
    fechaInicio, // ✅ Fechas
    fechaFin,    // ✅ Fechas
    sortBy,      // ✅ Ordenamiento
    order        // ✅ Ordenamiento
  } = queryParse.data;

  // 2. Lógica de "Calidad" (Permite ver KAIZEN)
  let esDepartamentoCalidad = false;
  let esAsignacionEspecial = false;

  if (user.rol === "SUPER_ADMIN") {
    esDepartamentoCalidad = true;
  } else if (user.departamentoId) {
    const depto = await prisma.departamento.findUnique({
      where: { id: user.departamentoId },
      select: { nombre: true },
    });
    if (depto) {
      if (depto.nombre.toUpperCase().includes("CALIDAD")) {
        esDepartamentoCalidad = true;
      }
      if (BUSINESS_RULES.departamentosAsignacionJerarquiaLibre.includes(depto.nombre)) {
        esAsignacionEspecial = true;
      }
    }
  }

  // 3. Determinar el contexto de agrupación para el RESUMEN
  // - SUPER_ADMIN sin filtro de depto -> Agrupa por DEPARTAMENTOS
  // - ADMIN o SUPER_ADMIN con filtro -> Agrupa por USUARIOS (Responsables)
  let agruparPor: 'DEPARTAMENTO' | 'USUARIO' = 'USUARIO'; 

  if (user.rol === 'SUPER_ADMIN' && !departamentoId) {
    agruparPor = 'DEPARTAMENTO';
  }

  // 4. Construcción del Filtro Base (WHERE)
  const where: Prisma.TareaWhereInput = {};
  const andClauses: Prisma.TareaWhereInput[] = [];

  // Filtros directos
  if (estatus) where.estatus = estatus;
  if (urgencia) where.urgencia = urgencia; // ✅ Filtro Urgencia

  // ✅ Filtro por Rango de Fechas (Registro)
  if (fechaInicio || fechaFin) {
    where.fechaRegistro = {
      ...(fechaInicio && { gte: fechaInicio }), // Mayor o igual
      ...(fechaFin && { lte: fechaFin })        // Menor o igual
    };
  }
  
  if (query) {
    andClauses.push({
      OR: [
        { tarea: { contains: query } },
        { observaciones: { contains: query } },
      ],
    });
  }

  // ✅ Filtro de Tiempo (KPIs)
  const hoy = new Date();
  if (tiempoFilter) {
    switch (tiempoFilter) {
      case "PENDIENTES_ATRASADAS":
        // Estatus Pendiente Y FechaLimite < Hoy
        where.estatus = "PENDIENTE";
        where.fechaLimite = { lt: hoy };
        break;
      case "PENDIENTES_A_TIEMPO":
        // Estatus Pendiente Y FechaLimite >= Hoy
        where.estatus = "PENDIENTE";
        where.fechaLimite = { gte: hoy };
        break;
      case "ENTREGADAS_ATRASADAS":
      case "ENTREGADAS_A_TIEMPO":
        // Para entregadas, filtramos por estatus relevante. 
        // La comparación exacta columna vs columna se hace mejor en memoria o con raw query
        where.estatus = { in: ["EN_REVISION", "CONCLUIDA"] };
        break;
    }
  }

  // --- LÓGICA DE PERMISOS POR ROL Y VIEWTYPE ---
  
  // A. SUPER ADMIN (Acceso total)
  if (user.rol === "SUPER_ADMIN") {
    if (departamentoId) where.departamentoId = departamentoId;
    if (asignadorId) where.asignadorId = asignadorId;
    if (responsableId) {
      andClauses.push({ responsables: { some: { usuarioId: responsableId } } });
    }
    
    // Si quiere ver "MIS_TAREAS" explícitamente
    if (viewType === "MIS_TAREAS") {
       andClauses.push({ responsables: { some: { usuarioId: user.id } } });
       agruparPor = 'USUARIO'; // Si ve sus tareas, agrupa por usuario (él mismo)
    } else if (viewType === "ASIGNADAS") {
       where.asignadorId = user.id;
       agruparPor = 'USUARIO';
    }
  } 
  
  // B. ADMIN / ENCARGADO
  else if (user.rol === "ADMIN" || user.rol === "ENCARGADO") {
    if (!user.departamentoId) return res.status(403).json({ error: "Sin departamento." });

    // Verificar si este depto tiene tareas externas habilitadas
    const deptoUsuario = await prisma.departamento.findUnique({
      where: { id: user.departamentoId },
      select: { tareasExternasHabilitadas: true }
    });
    const puedeAsignarExternas = deptoUsuario?.tareasExternasHabilitadas || false;

    if (asignadorId) where.asignadorId = asignadorId;
    if (responsableId) {
      andClauses.push({ responsables: { some: { usuarioId: responsableId } } });
    }

    switch (viewType) {
      case "MIS_TAREAS":
        // Solo donde soy responsable, sin importar depto
        andClauses.push({ responsables: { some: { usuarioId: user.id } } });
        if (departamentoId) {
          where.departamentoId = departamentoId;
        }
        break;

      case "ASIGNADAS":
        // Todo lo que YO asigné (incluyendo cross-dept si aplica)
        where.asignadorId = user.id;
        agruparPor = 'USUARIO';
        if (departamentoId) {
          if (puedeAsignarExternas || departamentoId === user.departamentoId) {
            where.departamentoId = departamentoId;
          } else {
            where.departamentoId = user.departamentoId;
          }
        }
        break;

      default: // "TODAS"
        // 🔹 NUEVA LÓGICA: tareas de mi depto + tareas cross-dept que mi departamento asignó
        if (puedeAsignarExternas) {
          andClauses.push({
            OR: [
              { departamentoId: user.departamentoId },
              { asignador: { departamentoId: user.departamentoId } }
            ]
          });
          if (departamentoId) {
            where.departamentoId = departamentoId;
          }
        } else {
          where.departamentoId = user.departamentoId;
        }

        if (user.rol === "ENCARGADO" && !esAsignacionEspecial) {
          andClauses.push({ responsables: { none: { usuario: { rol: "ADMIN" } } } });
        }
        break;
    }

    // Regla Anti-KAIZEN (solo si NO es de calidad)
    if (!esDepartamentoCalidad) {
      // No mostrar KAIZEN a quienes no son de calidad (a menos que sean responsable)
      const antiKaizenRule: Prisma.TareaWhereInput = {
        OR: [
          { tarea: { not: { startsWith: "KAIZEN" } } },
          {
            AND: [
              { tarea: { startsWith: "KAIZEN" } },
              { responsables: { some: { usuarioId: user.id } } },
            ],
          },
        ],
      };
      andClauses.push(antiKaizenRule);
    }
  } 
  
  // C. USUARIO / INVITADO
  else {
    andClauses.push({ responsables: { some: { usuarioId: user.id } } });
    if (!esDepartamentoCalidad) {
       andClauses.push({ tarea: { not: { startsWith: "KAIZEN" } } });
    }
  }

  // Integrar andClauses al where principal
  if (andClauses.length > 0) {
    where.AND = (where.AND as Prisma.TareaWhereInput[]) || [];
    where.AND.push(...andClauses);
  }

  // 5. Paginación y Ordenamiento Dinámico
  const pageNum = Math.max(1, page);
  const limitNum = Math.max(1, limit);
  const offset = (pageNum - 1) * limitNum;

  // ✅ Construir objeto orderBy dinámico
  const orderByClause: Prisma.TareaOrderByWithRelationInput = sortBy 
    ? { [sortBy]: order } 
    : { id: 'desc' };

  // 6. EJECUCIÓN OPTIMIZADA (DB Aggregations)
  const [totalItems, tareasPaginadas, groupEstatus, pendientesAtrasadasDB, pendientesATiempoDB] = await prisma.$transaction([
    prisma.tarea.count({ where }),
    prisma.tarea.findMany({
      where,
      include: tareaConRelacionesInclude,
      orderBy: orderByClause,
      take: limitNum,
      skip: offset,
    }),
    prisma.tarea.groupBy({
      by: ['estatus'],
      where: where,
      _count: { estatus: true },
      orderBy: { estatus: 'asc' } // ✅ Se agrega orderBy para corregir error TS2345
    }),
    prisma.tarea.count({ where: { ...where, estatus: 'PENDIENTE', fechaLimite: { lt: hoy } } }),
    prisma.tarea.count({ where: { ...where, estatus: 'PENDIENTE', fechaLimite: { gte: hoy } } }),
  ]);

  // 7. Preparar Resumen Global
  const resumenGeneral = {
    totales: {
      todas: totalItems,
      activas: 0,
      pendientes: 0,
      enRevision: 0,
      concluidas: 0,
      canceladas: 0,
    },
    tiempos: {
      pendientesAtrasadas: pendientesAtrasadasDB,
      pendientesATiempo: pendientesATiempoDB,
      entregadasAtrasadas: 0, // Se calculará en el desglose
      entregadasATiempo: 0,
    }
  };

  // Mapear resultados del groupBy a totales globales
  groupEstatus.forEach((g: any) => {
    const count = g._count?.estatus || 0;
    if (g.estatus === 'PENDIENTE') resumenGeneral.totales.pendientes = count;
    if (g.estatus === 'EN_REVISION') resumenGeneral.totales.enRevision = count;
    if (g.estatus === 'CONCLUIDA') resumenGeneral.totales.concluidas = count;
    if (g.estatus === 'CANCELADA') resumenGeneral.totales.canceladas = count;
  });
  resumenGeneral.totales.activas = resumenGeneral.totales.pendientes + resumenGeneral.totales.enRevision;

  // 8. DESGLOSE (SELECT LIGERO)
  // Aquí traemos solo lo necesario para el breakdown para no saturar la memoria
  const tareasParaDesglose = await prisma.tarea.findMany({
    where,
    select: {
      id: true,
      estatus: true,
      fechaLimite: true,
      fechaEntrega: true,
      fechaConclusion: true,
      departamentoId: true,
      departamento: { select: { nombre: true } },
      responsables: { 
        select: { 
          usuario: { select: { id: true, nombre: true } }
        } 
      }
    }
  });

  const breakdownMap = new Map<string | number, BreakdownMetrics>();

  // Función helper para actualizar una entrada del desglose
  const updateBreakdownEntry = (
    entry: BreakdownMetrics, 
    t: any, 
    tipoMetricaTiempo: keyof BreakdownMetrics | null
  ) => {
    entry.total++;
    if (t.estatus === "PENDIENTE") entry.pendientes++;
    if (t.estatus === "EN_REVISION") entry.enRevision++;
    if (t.estatus === "CONCLUIDA") entry.concluidas++;
    if (t.estatus === "CANCELADA") entry.canceladas++;
    if (t.estatus === "PENDIENTE" || t.estatus === "EN_REVISION") entry.activas++;

    if (tipoMetricaTiempo) {
      entry[tipoMetricaTiempo]++;
    }
  };

  tareasParaDesglose.forEach(t => {
    // Lógica de Tiempos
    const limite = new Date(t.fechaLimite);
    const fechaCumplimiento = t.fechaEntrega 
      ? new Date(t.fechaEntrega) 
      : t.fechaConclusion 
        ? new Date(t.fechaConclusion) 
        : null;

    let metricaTiempo: keyof BreakdownMetrics | null = null;

    if (t.estatus === 'PENDIENTE') {
      metricaTiempo = hoy > limite ? 'pendientesAtrasadas' : 'pendientesATiempo';
    } else if (t.estatus === 'EN_REVISION' || t.estatus === 'CONCLUIDA') {
      if (fechaCumplimiento && fechaCumplimiento.getTime() > limite.getTime()) {
        metricaTiempo = 'entregadasAtrasadas';
        resumenGeneral.tiempos.entregadasAtrasadas++;
      } else {
        metricaTiempo = 'entregadasATiempo';
        resumenGeneral.tiempos.entregadasATiempo++;
      }
    }

    // Llenado del Desglose
    if (agruparPor === 'DEPARTAMENTO') {
      const key = t.departamentoId;
      if (!breakdownMap.has(key)) {
        breakdownMap.set(key, initBreakdown(key, t.departamento.nombre));
      }
      updateBreakdownEntry(breakdownMap.get(key)!, t, metricaTiempo);
    } else {
      t.responsables.forEach((resp: any) => {
        const u = resp.usuario;
        if (!breakdownMap.has(u.id)) {
          breakdownMap.set(u.id, initBreakdown(u.id, u.nombre));
        }
        updateBreakdownEntry(breakdownMap.get(u.id)!, t, metricaTiempo);
      });
    }
  });

  // Ordenar desglose por urgencia (más atrasadas primero)
  const desgloseOrdenado = Array.from(breakdownMap.values()).sort((a, b) => {
    return b.pendientesAtrasadas - a.pendientesAtrasadas;
  });

  // 9. FILTRADO MANUAL FINAL (Limitación de Prisma para comparar columnas)
  let dataFinal = tareasPaginadas;
  if (tiempoFilter === "ENTREGADAS_ATRASADAS") {
    dataFinal = tareasPaginadas.filter(t => {
        const fc = t.fechaEntrega ? new Date(t.fechaEntrega) : (t.fechaConclusion ? new Date(t.fechaConclusion) : null);
        const lim = new Date(t.fechaLimite);
        return fc && fc.getTime() > lim.getTime();
    });
  } else if (tiempoFilter === "ENTREGADAS_A_TIEMPO") {
    dataFinal = tareasPaginadas.filter(t => {
        const fc = t.fechaEntrega ? new Date(t.fechaEntrega) : (t.fechaConclusion ? new Date(t.fechaConclusion) : null);
        const lim = new Date(t.fechaLimite);
        return fc && fc.getTime() <= lim.getTime();
    });
  }

  // 10. Limpieza de respuesta (Data Grid)
  const tareasLimpio = dataFinal.map((t) => ({
    ...t,
    responsables: t.responsables.map((r) => r.usuario),
  }));

  res.json({
    status: "success",
    meta: {
      pagination: {
        totalItems,
        itemsPorPagina: limitNum,
        paginaActual: pageNum,
        totalPaginas: Math.ceil(totalItems / limitNum),
      },
      resumen: {
        totales: resumenGeneral.totales,
        tiempos: resumenGeneral.tiempos,
        tipoDesglose: agruparPor,
        desglose: desgloseOrdenado
      }
    },
    data: tareasLimpio,
  });
});