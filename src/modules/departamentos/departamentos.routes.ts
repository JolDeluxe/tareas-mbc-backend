import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";

import { obtenerTodos } from "./get/obtenerTodos.controller.js";
import { crearDepartamento } from "./post/crearDepartamento.controller.js";
import { actualizarDepartamento } from "./put/actualizarDepartamento.controller.js";

const router = Router();

// Middleware Global para proteger rutas (Opcional, si quieres que todos requieran login)
router.use(verifyToken()); 

/* ✅ [GET] Obtener todos los departamentos */
// Si quieres protegerlo, descomenta verifyToken
router.get("/", verifyToken(), obtenerTodos);

/* ✅ [POST] Crear un nuevo departamento */
// Aquí es recomendable proteger para que solo ADMIN cree deptos
router.post("/", verifyToken(["SUPER_ADMIN"]), crearDepartamento);

/* ✅ [PUT] Actualizar un departamento */
router.put("/:id", verifyToken(["SUPER_ADMIN"]), actualizarDepartamento);

export default router;