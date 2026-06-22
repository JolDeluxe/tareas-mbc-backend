import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js"; // Middleware global

import { login } from "./post/login.controller.js";
import { logout } from "./post/logout.controller.js";
import { verify } from "./get/verify.controller.js";

const router = Router();

/* ✅ Login */
router.post("/login", login);

/* ✅ Verificar token */
// Usamos el middleware verifyToken para decodificar antes de llegar al controlador
router.get("/verify", verifyToken(), verify);

/* ✅ Logout */
router.post("/logout", logout);

export default router;