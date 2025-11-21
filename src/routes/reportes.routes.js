import { Router } from "express";
import {
  reporteVentas,
  reporteCompras,
  dashboard,
} from "../controllers/reportes.controller.js";

const router = Router();

// Todos los reportes son públicos (puedes protegerlos con authRequired si lo deseas)
router.get("/reportes/dashboard", dashboard);
router.get("/reportes/ventas", reporteVentas);
router.get("/reportes/compras", reporteCompras);

export default router;
