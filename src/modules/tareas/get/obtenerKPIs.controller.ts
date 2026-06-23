import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";

// Estructura para los contadores
interface Metrics {
  pendientesAtrasadas: number;
  pendientesATiempo: number;
  entregadasAtrasadas: number; // Revisión o Concluida (Entregó tarde)
  entregadasATiempo: number;   // Revisión o Concluida (Entregó a tiempo)
  total: number;
}

const initMetrics = (): Metrics => ({
  pendientesAtrasadas: 0,
  pendientesATiempo: 0,
  entregadasAtrasadas: 0,
  entregadasATiempo: 0,
  total: 0,
});

export const obtenerKPIs = safeAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Usuario no autenticado" });

  const { mes, anio, departamentoId: queryDeptoId } = req.query;

  // 1. Determinar contexto de agrupación (¿Vemos Deptos o Usuarios?)
  let agruparPor: 'DEPARTAMENTO' | 'USUARIO' = 'USUARIO'; // Default
  let deptoObjetivo: number | null = null;

  if (user.rol === "SUPER_ADMIN") {
    if (queryDeptoId) {
      // Super Admin filtrando un depto -> Ver usuarios de ese depto
      agruparPor = 'USUARIO';
      deptoObjetivo = Number(queryDeptoId);
    } else {
      // Super Admin sin filtro -> Ver lista de departamentos
      agruparPor = 'DEPARTAMENTO';
    }
  } else if (user.rol === "ADMIN" || user.rol === "ENCARGADO") {
    // Admin/Encargado siempre ve usuarios de SU depto
    if (!user.departamentoId) return res.status(403).json({ error: "Sin departamento asignado." });
    agruparPor = 'USUARIO';
    deptoObjetivo = user.departamentoId;
  } else {
    // Usuario normal (Opcional: solo se ve a sí mismo)
    agruparPor = 'USUARIO';
  }

  // 2. Construir el filtro WHERE
  const where: Prisma.TareaWhereInput = {};

  // Filtro de fecha (Opcional)
  if (mes && anio) {
    const startDate = new Date(Number(anio), Number(mes) - 1, 1);
    const endDate = new Date(Number(anio), Number(mes), 0, 23, 59, 59);
    where.fechaLimite = {
      gte: startDate,
      lte: endDate,
    };
  }

  // Filtro de Departamento (Si aplica)
  if (deptoObjetivo) {
    if (user.rol === "SUPER_ADMIN") {
      where.departamentoId = deptoObjetivo;
    } else {
      // Para ADMIN/ENCARGADO, si puede asignar externas, mostramos:
      // tareas de su depto OR tareas que él asignó.
      const deptoUsuario = await prisma.departamento.findUnique({
        where: { id: user.departamentoId! },
        select: { tareasExternasHabilitadas: true }
      });
      const puedeAsignarExternas = deptoUsuario?.tareasExternasHabilitadas || false;

      if (puedeAsignarExternas) {
        where.OR = [
          { departamentoId: user.departamentoId! },
          { asignador: { departamentoId: user.departamentoId! } }
        ];
      } else {
        where.departamentoId = user.departamentoId!;
      }
    }
  }

  // Filtro de seguridad para roles bajos (si no es admin/encargado)
  if (user.rol === "USUARIO" || user.rol === "INVITADO") {
    where.OR = [
      { asignadorId: user.id },
      { responsables: { some: { usuarioId: user.id } } }
    ];
  }

  // Regla Anti-KAIZEN (solo si NO es de calidad/superadmin)
  let esDepartamentoCalidad = false;
  if (user.rol === "SUPER_ADMIN") {
    esDepartamentoCalidad = true;
  } else if (user.departamentoId) {
    const depto = await prisma.departamento.findUnique({
      where: { id: user.departamentoId },
      select: { nombre: true },
    });
    if (depto?.nombre.toUpperCase().includes("CALIDAD")) {
      esDepartamentoCalidad = true;
    }
  }

  if (!esDepartamentoCalidad) {
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

    if (where.OR) {
      const existingOR = where.OR;
      delete where.OR;
      where.AND = [
        { OR: existingOR },
        antiKaizenRule
      ];
    } else {
      where.AND = [antiKaizenRule];
    }
  }

  // 3. Consultar Tareas
  const tareas = await prisma.tarea.findMany({
    where,
    select: {
      id: true,
      estatus: true,
      fechaLimite: true,
      fechaEntrega: true, // Fecha real de cuando el usuario subió evidencia
      fechaConclusion: true,
      departamentoId: true,
      departamento: {
        select: { nombre: true }
      },
      responsables: {
        select: {
          usuario: {
            select: { id: true, nombre: true }
          }
        }
      }
    }
  });

  // 4. Procesar Datos
  const generalStats = initMetrics();
  // Map para agrupar: Key (ID Depto o Usuario) -> Metrics + Info
  const breakdownMap = new Map<number | string, any>();

  const hoy = new Date();

  tareas.forEach((t) => {
    const limite = new Date(t.fechaLimite);
    
    // Determinar la fecha de cumplimiento real
    // Si existe fechaEntrega (el usuario mandó a revisión), esa es la que cuenta para protegerlo.
    // Si no, y está concluida (legacy), usamos fechaConclusion.
    const fechaCumplimiento = t.fechaEntrega 
      ? new Date(t.fechaEntrega) 
      : t.fechaConclusion 
        ? new Date(t.fechaConclusion) 
        : null;

    // --- Determinar Tipo de Métrica para esta Tarea ---
    let tipoMetrica: keyof Metrics | null = null;

    // LÓGICA DE NEGOCIO CLAVE
    if (t.estatus === 'PENDIENTE') {
      // Si sigue pendiente, comparamos contra HOY
      if (hoy > limite) {
        tipoMetrica = 'pendientesAtrasadas'; // Rojo
      } else {
        tipoMetrica = 'pendientesATiempo';   // Normal
      }
    } else if (t.estatus === 'EN_REVISION' || t.estatus === 'CONCLUIDA') {
      // Si ya entregó, comparamos FECHA_ENTREGA vs LIMITE
      // Esto protege al usuario si el admin tarda en revisar
      if (fechaCumplimiento && fechaCumplimiento.getTime() > limite.getTime()) {
        tipoMetrica = 'entregadasAtrasadas'; // Naranja (Cumplió pero tarde)
      } else {
        tipoMetrica = 'entregadasATiempo';   // Verde (Cumplió a tiempo)
      }
    }
    // Canceladas se ignoran en estos KPIs específicos

    if (tipoMetrica) {
      // A. Sumar al General
      generalStats[tipoMetrica]++;
      generalStats.total++;

      // B. Sumar al Desglose (Breakdown)
      if (agruparPor === 'DEPARTAMENTO') {
        // --- Agrupar por DEPARTAMENTO ---
        const key = t.departamentoId;
        if (!breakdownMap.has(key)) {
          breakdownMap.set(key, { 
            id: key, 
            nombre: t.departamento.nombre, 
            ...initMetrics() 
          });
        }
        const entry = breakdownMap.get(key);
        entry[tipoMetrica]++;
        entry.total++;

      } else {
        // --- Agrupar por USUARIO (Responsables) ---
        // Nota: Si una tarea tiene 2 responsables, cuenta para los dos en sus KPIs individuales
        t.responsables.forEach((resp) => {
          const u = resp.usuario;
          const key = u.id;
          
          if (!breakdownMap.has(key)) {
            breakdownMap.set(key, { 
              id: key, 
              nombre: u.nombre, 
              ...initMetrics() 
            });
          }
          const entry = breakdownMap.get(key);
          // Usamos '!' porque ya validamos que tipoMetrica no es null arriba
          entry[tipoMetrica!] ++; 
          entry.total++;
        });
      }
    }
  });

  // 5. Convertir Map a Array y Ordenar
  // Ordenamos por quien tiene más pendientes atrasadas (urgencia)
  const breakdownArray = Array.from(breakdownMap.values()).sort((a, b) => {
    return b.pendientesAtrasadas - a.pendientesAtrasadas;
  });

  // 6. Respuesta
  res.json({
    vista: agruparPor, // "DEPARTAMENTO" o "USUARIO" para saber qué columnas pintar en front
    departamentoId: deptoObjetivo,
    general: generalStats,
    desglose: breakdownArray
  });
});