import { Router } from 'express';
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '../controllers/categorias.controller.js';

const router = Router();

router.get("/categorias", listarCategorias);
router.post("/categorias", crearCategoria);
router.put("/categorias/:id", actualizarCategoria);
router.delete("/categorias/:id", eliminarCategoria);

export default router;
