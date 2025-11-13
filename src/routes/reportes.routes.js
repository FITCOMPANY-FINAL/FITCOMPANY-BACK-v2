import { Router } from "express";
import { obtenerReporteVentasSemanal, obtenerReporteComprasSemanal } from "../controllers/reportes.controller.js";

const router = Router();

router.get("/ventas", obtenerReporteVentasSemanal);

router.get("/compras", obtenerReporteComprasSemanal);

export default router;
