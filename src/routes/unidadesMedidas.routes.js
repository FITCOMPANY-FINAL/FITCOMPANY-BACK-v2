import { Router } from 'express';
import {
  listarUnidadesMedida,
  crearUnidadMedida,
  actualizarUnidadMedida,
  eliminarUnidadMedida,
} from '../controllers/unidadMedida.controller.js';


const router = Router()

router.get("/unidades-medida", listarUnidadesMedida);
router.post("/unidades-medida", crearUnidadMedida);
router.put("/unidades-medida/:id", actualizarUnidadMedida);
router.delete("/unidades-medida/:id", eliminarUnidadMedida);


export default router