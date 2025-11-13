import express from 'express';
import {
  listarRoles,
  crearRol,
  actualizarRol,
  eliminarRol
} from '../controllers/roles.controller.js';

const router = express.Router();

router.get('/roles', listarRoles);
router.post('/roles', crearRol);
router.put('/roles/:id', actualizarRol);
router.delete('/roles/:id', eliminarRol);

export default router;
