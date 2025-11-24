// src/routes/setup-migrate-ventas.routes.js
// Rutas para migrar la tabla ventas

import { Router } from "express";
import { migrateVentasTable } from "../controllers/setup-migrate-ventas.controller.js";

const router = Router();

// POST /api/setup/migrate-ventas - Agregar columnas de soft delete a ventas
router.post("/setup/migrate-ventas", migrateVentasTable);

export default router;
