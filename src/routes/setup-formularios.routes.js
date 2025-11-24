// src/routes/setup-formularios.routes.js
// Rutas para setup de formularios

import { Router } from "express";
import { setupFormularios } from "../controllers/setup-formularios.controller.js";

const router = Router();

// POST /api/setup/formularios - Crear formularios base
router.post("/setup/formularios", setupFormularios);

export default router;
