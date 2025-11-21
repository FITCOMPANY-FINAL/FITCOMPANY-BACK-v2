import { Router } from "express";
import {
  listarVentas,
  obtenerVentaPorId,
  crearVenta,
  eliminarVenta,
} from "../controllers/ventas.controller.js";
import { authRequired } from "../middlewares/authMiddleware.js";

const router = Router();

// GET públicas (listar ventas, obtener detalle)
router.get("/ventas", listarVentas);
router.get("/ventas/:id", obtenerVentaPorId);

// POST/DELETE protegidas
router.post("/ventas", authRequired, crearVenta);
router.delete("/ventas/:id", authRequired, eliminarVenta);

export default router;
