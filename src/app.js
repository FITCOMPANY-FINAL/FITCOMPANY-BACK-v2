import dotenv from "dotenv";
dotenv.config();
import express, { json, urlencoded } from "express";
import cors from "cors";
import morgan from "morgan";
import { initializeDatabase } from "./utils/initializeDatabase.js";

// ============================================
// RUTAS MIGRADAS A POSTGRESQL ✅
// ============================================
import categoriasRoutes from "./routes/categorias.routes.js";
import unidadesMedidasRoutes from "./routes/unidadesMedidas.routes.js";
import tipoIdentificacionRoutes from "./routes/tipoIdentificacion.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import formulariosRoutes from "./routes/formularios.routes.js";
import permisosRoutes from "./routes/permisos.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";

// ============================================
// RUTAS PENDIENTES DE MIGRAR ⏳
// (Comentadas temporalmente hasta migrar sus controladores)
// ============================================
import authRoutes from "./routes/auth.routes.js";
import productosRoutes from "./routes/productos.routes.js";
import comprasRoutes from "./routes/compras.routes.js";
import metodosPagoRoutes from "./routes/metodosPago.routes.js";
import ventasRoutes from "./routes/ventas.routes.js";
import reportesRoutes from "./routes/reportes.routes.js";

const app = express();

// Middlewares globales
app.use(cors());
app.use(morgan("dev"));
app.use(json());
app.use(urlencoded({ extended: true }));

// ============================================
// RUTAS ACTIVAS ✅
// ============================================
app.use("/api", categoriasRoutes);
app.use("/api", unidadesMedidasRoutes);
app.use("/api", tipoIdentificacionRoutes);
app.use("/api", rolesRoutes);
app.use("/api", formulariosRoutes);
app.use("/api", permisosRoutes);
app.use("/api", usuariosRoutes);

// ============================================
// RUTAS COMENTADAS (PENDIENTES DE MIGRACIÓN) ⏳
// ============================================
app.use("/api", authRoutes);
app.use("/api", productosRoutes);
app.use("/api", comprasRoutes);
app.use("/api", metodosPagoRoutes);
app.use("/api", ventasRoutes);
app.use("/api", reportesRoutes);

app.get("/", (req, res) => {
  res.send(
    "✅ Servidor Express funcionando - PostgreSQL (Migración en progreso)",
  );
});

const PORT = process.env.PORT || 3000;

// Inicializar base de datos y luego iniciar servidor
(async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`✅ Servidor activo en http://localhost:${PORT}`);
      console.log(`📊 Base de datos: PostgreSQL`);
      console.log(`🎉 Controladores migrados: 12/12 (100% COMPLETO ✅)`);
    });
  } catch (error) {
    console.error("❌ Error fatal al iniciar:", error.message);
    process.exit(1);
  }
})();
