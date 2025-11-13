import { Router } from "express";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  existeProducto,           
} from "../controllers/productos.controller.js";

const router = Router();

router.get("/productos", listarProductos);
router.get("/productos/existe", existeProducto);   
router.post("/productos", crearProducto);
router.put("/productos/:id", actualizarProducto);
router.delete("/productos/:id", eliminarProducto);

export default router;

