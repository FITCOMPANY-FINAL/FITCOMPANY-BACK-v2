import { Router } from "express";
import { listarFormularios } from "../controllers/formularios.controller.js";

const router = Router();

router.get("/formularios", listarFormularios);

export default router;
