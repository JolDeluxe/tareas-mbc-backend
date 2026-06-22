import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";

// ✅ Getters Optimizados
import { obtenerTodos } from "./get/obtenerTodos.controller.js";
import { obtenerInactivos } from "./get/obtenerInactivos.controller.js";
import { obtenerPorId } from "./get/obtenerPorId.controller.js";

// ✅ Post Controllers
import { crearUsuario } from "./post/crearUsuario.controller.js";
import { suscribirPush } from "./post/suscribirPush.controller.js";

// ✅ Put Controllers
import { actualizarUsuario } from "./put/actualizarUsuario.controller.js";
import { cambiarEstatus } from "./put/cambiarEstatus.controller.js";

const router = Router();

// ===================================================================
// CRUD DE USUARIOS
// ===================================================================

// 🔒 Middleware Global: Verifica que haya un token válido en todas las rutas
// El objeto req.user estará disponible en todos los controladores siguientes
router.use(verifyToken());

// ---------------------------------------------------------
// 1. RUTAS DE LECTURA (GET)
// ---------------------------------------------------------

/* ✅ [READ] Obtener usuarios activos (Consolidado)
  Uso desde el Front:
  - Todos: GET /api/usuarios
  - Solo Invitados: GET /api/usuarios?rol=INVITADO
  - Solo Usuarios: GET /api/usuarios?rol=USUARIO
  - Búsqueda: GET /api/usuarios?q=Juan
  - Paginación: GET /api/usuarios?page=2&limit=20
*/
router.get("/", obtenerTodos);

/* ✅ [READ] Obtener usuarios inactivos (Papelera)
  - Solo accesible para roles administrativos y encargados
*/
router.get("/inactivos", verifyToken(["SUPER_ADMIN", "ADMIN", "ENCARGADO"]), obtenerInactivos);

/* ✅ [READ BY ID] Obtener un usuario específico
*/
router.get("/:id", obtenerPorId);

// ---------------------------------------------------------
// 2. RUTAS DE ESCRITURA (POST/PUT)
// ---------------------------------------------------------

/* ✅ [CREATE] Crear un nuevo usuario 
  - Solo SUPER_ADMIN y ADMIN pueden crear personal
*/
router.post("/", verifyToken(["SUPER_ADMIN", "ADMIN"]), crearUsuario);

/* ✅ [UPDATE] Actualizar un usuario existente
  - Edición de datos generales
*/
router.put("/:id", verifyToken(["SUPER_ADMIN", "ADMIN"]), actualizarUsuario);

/* ✅ [UPDATE STATUS] Desactivar (Soft Delete) o Reactivar
  - Ruta dedicada para manejo de estatus seguro
*/
router.put("/:id/estatus", verifyToken(["SUPER_ADMIN", "ADMIN"]), cambiarEstatus);

/* ✅ [SUBSCRIBE] Registrar suscripción para notificaciones Push
  - Abierto a cualquier usuario autenticado para registrar SU dispositivo
*/
router.post("/:id/subscribe", suscribirPush);

export default router;