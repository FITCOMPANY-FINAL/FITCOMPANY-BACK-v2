// src/routes/setup-clean.routes.js
// Rutas para limpiar y recrear formularios con estructura correcta

import { Router } from "express";
import { cleanAndSetup } from "../controllers/setup-clean.controller.js";

const router = Router();

// POST /api/setup/clean - Limpiar y recrear base de datos
router.post("/setup/clean", cleanAndSetup);

export default router;
