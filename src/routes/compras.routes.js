import { Router } from "express";
import {
  listarCompras,
  obtenerCompraPorId,
  crearCompra,
  actualizarCompra,
  eliminarCompra,
} from "../controllers/compras.controller.js";
import { authRequired } from "../middlewares/authMiddleware.js";

const router = Router();

// Rutas públicas (o con auth opcional)
router.get("/compras", listarCompras);
router.get("/compras/:id", obtenerCompraPorId);

// Rutas protegidas (requieren autenticación JWT)
router.post("/compras", authRequired, crearCompra);
router.put("/compras/:id", authRequired, actualizarCompra);
router.delete("/compras/:id", authRequired, eliminarCompra);

export default router;
