import dotenv from 'dotenv';
dotenv.config();
import express, { json, urlencoded } from 'express';
import cors from 'cors';
import morgan from 'morgan';


import authRoutes from './routes/auth.routes.js';
import categoriasRoutes from './routes/categorias.routes.js';
import unidadesMedidasRoutes from './routes/unidadesMedidas.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import productosRoutes from './routes/productos.routes.js';
import perfilesRoutes from './routes/perfiles.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import ventasRoutes from './routes/ventas.routes.js'; 
import comprasRoutes from './routes/compras.routes.js';
import tipoIdentificacionRoutes from "./routes/tipoIdentificacion.routes.js";
import permisosRoutes from './routes/permisos.routes.js';
import formulariosRoutes from './routes/formularios.routes.js';
import reportesRoutes from "./routes/reportes.routes.js";

const app = express();

// Middlewares globales
app.use(cors());
app.use(morgan('dev'));
app.use(json());
app.use(urlencoded({ extended: true }));

//* RUTAS
app.use("/api", authRoutes);
app.use("/api", categoriasRoutes);
app.use("/api", unidadesMedidasRoutes);
app.use("/api", rolesRoutes);
app.use("/api", productosRoutes);
app.use("/api", perfilesRoutes);
app.use("/api", usuariosRoutes);
app.use("/api", ventasRoutes); 
app.use('/api', comprasRoutes);
app.use("/api", tipoIdentificacionRoutes);
app.use("/api", permisosRoutes);
app.use("/api", formulariosRoutes);
app.use("/api/reportes", reportesRoutes);

app.get('/', (req, res) => {
  res.send('Servidor Express funcionando');
});

const PORT = process.env.port || 3000;

app.listen(PORT, () => {
  console.log(`✅ Servidor activo en http://localhost:${PORT}`);
});
