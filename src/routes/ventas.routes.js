import { Router } from "express";
import {
  crearVenta,
  obtenerVentas,
  eliminarVenta,
  actualizarVenta,
  obtenerVentaPorId,
} from "../controllers/ventas.controller.js";
import { authRequired } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/ventas", obtenerVentas);
router.get("/ventas/:id", obtenerVentaPorId);
router.post("/ventas", authRequired, crearVenta);
router.put("/ventas/:id", authRequired, actualizarVenta);
router.delete("/ventas/:id", authRequired, eliminarVenta);

export default router;
