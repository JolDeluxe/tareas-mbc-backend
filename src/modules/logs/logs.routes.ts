import { Router } from "express";
import { getLogs } from "./getLogs.controller.js"; 
import { verifyToken } from "../../middleware/verifyToken.js";

const router = Router();

// Endpoint: GET /api/logs
// Seguridad: Solo SUPER_ADMIN puede ver la bitácora completa
router.get("/", verifyToken(["SUPER_ADMIN"]), getLogs);

export default router;