// knexfile.js
// Configuración de Knex para diferentes ambientes

import 'dotenv/config';

// Configuración principal
const config = {
  // ==========================================
  // AMBIENTE: DESARROLLO (tu máquina local)
  // ==========================================
  development: {
    // Cliente de base de datos
    client: 'pg',
    
    // Configuración de conexión
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    },
    
    // Configuración de migraciones
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    
    // Configuración de seeds
    seeds: {
      directory: './database/seeds'
    },
    
    // Pool de conexiones (cuántas conexiones simultáneas)
    pool: {
      min: 2,    // Mínimo 2 conexiones
      max: 10    // Máximo 10 conexiones
    }
  },

  // ==========================================
  // AMBIENTE: STAGING (servidor de pruebas)
  // ==========================================
  staging: {
    client: 'pg',
    
    // En staging/producción usamos DATABASE_URL
    connection: process.env.DATABASE_URL,
    
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    
    seeds: {
      directory: './database/seeds'
    },
    
    pool: {
      min: 2,
      max: 10
    }
  },

  // ==========================================
  // AMBIENTE: PRODUCCIÓN (servidor real)
  // ==========================================
  production: {
    client: 'pg',
    
    // URL de conexión desde variable de entorno
    connection: process.env.DATABASE_URL,
    
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    
    seeds: {
      directory: './database/seeds'
    },
    
    // Pool más grande para producción
    pool: {
      min: 2,
      max: 20    // Más conexiones para manejar más tráfico
    },
    
    // Timeout de conexión
    acquireConnectionTimeout: 10000
  }
};

// Exportar configuración (ES Modules)
export default config;