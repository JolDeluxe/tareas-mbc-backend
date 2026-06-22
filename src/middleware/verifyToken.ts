/* middleware/verifyToken.ts */

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const SECRET = process.env.JWT_SECRET || "default_secret";
const prisma = new PrismaClient();

/**
 * Define los roles permitidos en la aplicación.
 */
type Rol = "SUPER_ADMIN" | "ADMIN" | "ENCARGADO" | "USUARIO" | "INVITADO";

/**
 * Define la estructura de datos (payload) que se guarda
 * dentro del JWT.
 */
export interface TokenPayload {
  id: number;
  nombre: string;
  username: string;
  rol: Rol;
  departamentoId: number | null;
}

/**
 * Middleware de autenticación y autorización.
 */
export const verifyToken = (requiredRoles?: Rol | Rol[]) => {
  // 👈 3. CONVERTIR EN ASYNC
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Obtener el header 'Authorization'
      const header = req.headers["authorization"];
      if (!header) {
        return res.status(401).json({ error: "Token no proporcionado" });
      }

      // 2. Extraer el token
      const token = header.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Token vacío o mal formado" });
      }

      // 3. Verificar y decodificar el token
      const decoded = jwt.verify(token, SECRET) as TokenPayload;

      // 👈 4. AÑADIR VERIFICACIÓN DE ESTATUS EN LA BD
      // Esta es la comprobación de seguridad clave:
      const usuario = await prisma.usuario.findFirst({
        where: {
          id: decoded.id,
          estatus: "ACTIVO", // ¡Asegurarse de que el usuario siga ACTIVO!
        },
      });

      // Si no se encuentra (porque fue borrado o está INACTIVO), rechazar.
      if (!usuario) {
        return res
          .status(401)
          .json({ error: "Usuario no autorizado o inactivo" });
      }

      // 5. Adjuntar la información del usuario al objeto 'req'
      // Usamos 'decoded' porque son los datos del token
      req.user = decoded;

      // 6. Validación de Roles (Autorización)
      if (requiredRoles) {
        const rolesPermitidos = Array.isArray(requiredRoles)
          ? requiredRoles
          : [requiredRoles];

        // Usamos 'req.user.rol' (del token) para la validación
        if (!rolesPermitidos.includes(req.user.rol)) {
          return res.status(403).json({
            error: `Acceso restringido. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(
              ", "
            )}`,
          });
        }
      }

      // 7. Si todo está bien, pasar al siguiente middleware
      next();
    } catch (error) {
      // Si jwt.verify falla (token expirado, inválido, etc.)
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
  };
};
