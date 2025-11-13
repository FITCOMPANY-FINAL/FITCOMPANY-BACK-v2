import express from 'express';
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} from '../controllers/usuarios.controller.js';

const router = express.Router();

router.get('/usuarios', listarUsuarios);
router.post('/usuarios', crearUsuario);
router.put('/usuarios/:tipo/:id', actualizarUsuario);
router.delete('/usuarios/:tipo/:id', eliminarUsuario);

export default router;
