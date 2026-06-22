import { Prisma } from "@prisma/client";

// Include para listas y creación/edición
export const tareaConRelacionesInclude = {
  departamento: { select: { id: true, nombre: true } },
  asignador: { 
    select: { 
      id: true, 
      nombre: true, 
      rol: true,
      departamentoId: true,
      departamento: { select: { nombre: true } }
    } 
  },
  responsables: {
    select: {
      usuario: { select: { id: true, nombre: true, rol: true } },
    },
  },
  imagenes: { 
    select: { id: true, url: true, fechaSubida: true } 
  },
  historialFechas: {
    include: { modificadoPor: { select: { id: true, nombre: true } } },
    orderBy: { fechaCambio: "desc" },
  },
} satisfies Prisma.TareaInclude;

// Include para detalle completo (GET /:id)
export const tareaDetalladaInclude = {
  ...tareaConRelacionesInclude, // Hereda lo anterior
} satisfies Prisma.TareaInclude;

// Tipos inferidos para usar en TypeScript en los controladores
export type TareaConRelaciones = Prisma.TareaGetPayload<{
  include: typeof tareaConRelacionesInclude;
}>;