import { Router } from 'express';
import {
  registrarCompra,
  obtenerCompras,
  eliminarCompra,
  actualizarCompra
} from '../controllers/compras.controller.js';
import { authRequired } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/compras', obtenerCompras);

// Los que escriben requieren usuario autenticado
router.post('/compras', authRequired, registrarCompra);
router.put('/compras/:id', authRequired, actualizarCompra);
router.delete('/compras/:id', authRequired, eliminarCompra);

export default router;
