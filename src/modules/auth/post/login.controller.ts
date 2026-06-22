import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../../config/db.js";
import { envs } from "../../../config/envs.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { loginSchema } from "../schemas/auth.schema.js";

export const login = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar con Zod
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      detalles: parseResult.error.flatten().fieldErrors,
    });
  }
  const { username, password } = parseResult.data;

  // 2. Buscar usuario por username Y que esté ACTIVO
  const usuario = await prisma.usuario.findFirst({
    where: {
      username: username,
      estatus: "ACTIVO",
    },
  });

  // 3. Verificar contraseña
  const passwordValida = usuario
    ? await bcrypt.compare(password, usuario.password)
    : false;

  // 4. Verificar si el usuario existe Y la contraseña es válida
  if (!usuario || !passwordValida) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  // 5. Generar el Token (Usando configuración centralizada)
  const tokenPayload = {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    rol: usuario.rol,
    departamentoId: usuario.departamentoId,
  };

  const token = jwt.sign(tokenPayload, envs.JWT_SECRET, {
    // 👇 FIX: Usamos 'as any' para que TypeScript acepte el string de Zod
    expiresIn: envs.JWT_EXPIRES as any, 
  });

  // 6. Enviar respuesta
  res.json({
    message: "Inicio de sesión exitoso",
    token,
    usuario: { ...tokenPayload },
  });
});