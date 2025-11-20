import { Router } from "express";
import {
  listarCompras,
  obtenerCompraPorId,
  crearCompra,
  eliminarCompra,
} from "../controllers/compras.controller.js";
import { authRequired } from "../middlewares/authMiddleware.js";

const router = Router();

// Rutas públicas (o con auth opcional)
router.get("/compras", listarCompras);
router.get("/compras/:id", obtenerCompraPorId);

// Rutas protegidas (requieren autenticación JWT)
router.post("/compras", authRequired, crearCompra);
router.delete("/compras/:id", authRequired, eliminarCompra);

// NO implementamos PUT (actualizar compra) por simplicidad
// Si se necesita modificar: eliminar y crear nueva

export default router;
