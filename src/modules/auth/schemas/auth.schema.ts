import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().nonempty("El username es requerido"),
  password: z.string().nonempty("La contraseña es requerida"),
});