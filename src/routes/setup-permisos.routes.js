// src/routes/setup-permisos.routes.js
// Rutas para setup de permisos

import { Router } from "express";
import { setupPermisos } from "../controllers/setup-permisos.controller.js";

const router = Router();

// POST /api/setup/permisos - Asignar permisos a roles
router.post("/setup/permisos", setupPermisos);

export default router;
