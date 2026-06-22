import { z } from "zod";
import { Tipo } from "@prisma/client";

// Validación de ID en URL
export const paramsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "El ID debe ser un número")
    .transform(Number)
    .refine((num) => num > 0, "El ID debe ser positivo"),
});

// Esquema base para crear (POST)
export const deptoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .nonempty("El nombre es requerido")
    .min(3, "El nombre debe tener al menos 3 caracteres"),
  tipo: z.nativeEnum(Tipo, {
    message: "Tipo inválido (Debe ser ADMINISTRATIVO o OPERATIVO)",
  }),
});

// Esquema para actualizar (PUT)
export const actualizarDeptoSchema = deptoSchema
  .partial()
  .extend({
    tareasExternasHabilitadas: z.boolean().optional(),
  })
  .refine((data) => data.nombre !== undefined || data.tipo !== undefined || data.tareasExternasHabilitadas !== undefined, {
    message: "Debe proporcionar al menos un campo para actualizar.",
  });