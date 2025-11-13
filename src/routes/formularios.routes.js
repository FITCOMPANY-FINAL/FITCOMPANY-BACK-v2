import express from "express";
import { listarFormularios } from "../controllers/formularios.controller.js";

const router = express.Router();

router.get("/formularios", listarFormularios);

export default router;
