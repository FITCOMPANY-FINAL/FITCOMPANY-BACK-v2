// src/routes/setup.routes.js
// Rutas de setup (temporal para crear datos iniciales)

import { Router } from "express";
import { setupDatabase } from "../controllers/setup.controller.js";

const router = Router();

// POST /api/setup/create-data - Crear datos iniciales
router.post("/setup/create-data", setupDatabase);

export default router;
