import { Router } from 'express';
import {
  listarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  eliminarMetodoPago
} from '../controllers/metodosPago.controller.js';

const router = Router();

// Rutas públicas
router.get('/metodos-pago', listarMetodosPago);

// Rutas para administración (sin authRequired por ahora, se puede agregar después)
router.post('/metodos-pago', crearMetodoPago);
router.put('/metodos-pago/:id', actualizarMetodoPago);
router.delete('/metodos-pago/:id', eliminarMetodoPago);

export default router;
