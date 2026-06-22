import type { Request, Response } from "express";
import { safeAsync } from "../../../utils/safeAsync.js";

export const logout = safeAsync(async (_req: Request, res: Response) => {
  res.json({
    message: "Sesión cerrada correctamente (token eliminado en frontend)",
  });
});