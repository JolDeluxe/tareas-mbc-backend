import { z } from "zod";
import { Rol, EstatusUsuario } from "@prisma/client";

// ==========================================
// SCHEMAS DE UTILIDAD
// ==========================================

export const querySchema = z.object({
  // Filtros existentes
  departamentoId: z.coerce.number().int().positive().optional(),
  estatus: z.nativeEnum(EstatusUsuario).optional(),
  
  // ✅ NUEVOS FILTROS (Agregados para la arquitectura robusta)
  rol: z.nativeEnum(Rol).optional(), // Permite filtrar por rol específico
  q: z.string().trim().optional(),   // Buscador general (nombre o username)
  
  // ✅ PAGINACIÓN (Con valores por defecto)
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
});

export const paramsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "El ID debe ser un número")
    .transform(Number)
    .refine((num) => num > 0, "El ID debe ser positivo"),
});

export const estatusSchema = z.object({
  estatus: z.nativeEnum(EstatusUsuario, {
    message: "Estatus inválido (Debe ser ACTIVO o INACTIVO)",
  }),
});

export const subscriptionSchema = z.object({
  endpoint: z.string().url("El endpoint debe ser una URL válida"),
  keys: z.object({
    p256dh: z.string().min(1, "La clave p256dh es requerida"),
    auth: z.string().min(1, "La clave auth es requerida"),
  }),
});


export const identifierSchema = z.object({
  id: z.string().trim().min(1, "El identificador no puede estar vacío"),
});

// ==========================================
// SCHEMA PARA CREAR USUARIO
// ==========================================

export const crearUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es requerido").min(3, "El nombre debe tener al menos 3 caracteres"),
    username: z.string().trim().min(1, "El username es requerido").min(4, "El username debe tener al menos 4 caracteres"),
    password: z.string().min(1, "La contraseña es requerida").min(6, "La contraseña debe tener al menos 6 caracteres"),
    rol: z.nativeEnum(Rol, { message: "Rol inválido" }),
    
    // 🛡️ SOLUCIÓN: Usamos z.union para aceptar explícitamente número positivo O null
    departamentoId: z.union([
      z.number().int().positive(), 
      z.null()
    ]).optional(),
  })
  .superRefine((data, ctx) => {
    // Regla 1: Roles Externos (SUPER_ADMIN, INVITADO) -> departamentoId DEBE ser null o undefined
    if (["SUPER_ADMIN", "INVITADO"].includes(data.rol)) {
      if (data.departamentoId !== null && data.departamentoId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El usuario con rol ${data.rol} NO puede tener un departamento asignado.`,
          path: ["departamentoId"],
        });
      }
    }

    // Regla 2: Roles Internos (ADMIN, ENCARGADO, USUARIO) -> departamentoId ES OBLIGATORIO (número)
    if (["ADMIN", "ENCARGADO", "USUARIO"].includes(data.rol)) {
      if (typeof data.departamentoId !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El usuario con rol ${data.rol} requiere un departamentoId válido.`,
          path: ["departamentoId"],
        });
      }
    }
  });

// ==========================================
// SCHEMA PARA ACTUALIZAR USUARIO
// ==========================================

export const actualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").optional(),
    username: z.string().trim().min(4, "El username debe tener al menos 4 caracteres").optional(),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
    rol: z.nativeEnum(Rol, { message: "Rol inválido" }).optional(),
    departamentoId: z.union([z.number().int().positive(), z.null()]).optional(),
    estatus: z.nativeEnum(EstatusUsuario).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe proporcionar al menos un campo para actualizar.",
  });