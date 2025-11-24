// insert-seed-data.js
// Script para insertar datos base en Render (sin commit)
// Inserta: tipos_identificacion, roles, y usuarios

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const connectionString = 'postgresql://gimnasio_db_ghso_user:QdAVcykIr0WY4aN24jJ4cb3hw4JhspLo@dpg-d4hsm13uibrs73dqnqi0-a.onrender.com:5432/gimnasio_db_ghso';

console.log('🌱 Insertando datos base en Render...\n');

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 60000,
  statement_timeout: 60000,
});

try {
  await client.connect();
  console.log('✅ Conectado a PostgreSQL en Render\n');

  // 1. INSERTAR TIPO DE IDENTIFICACIÓN
  console.log('📝 Paso 1: Insertando Tipo de Identificación...');
  try {
    await client.query(
      `INSERT INTO tipos_identificacion (nombre_tipo_identificacion, abreviatura_tipo_identificacion, descripcion_tipo_identificacion, activo)
       VALUES ($1, $2, $3, $4)`,
      ['Cédula de Ciudadanía', 'CC', 'Documento de identificación colombiano', true]
    );
    console.log('✅ Tipo de Identificación (CC) creado\n');
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️ Tipo de Identificación ya existe\n');
    } else {
      throw error;
    }
  }

  // 2. INSERTAR ROLES
  console.log('📝 Paso 2: Insertando Roles...');

  try {
    await client.query(
      `INSERT INTO roles (nombre_rol, descripcion_rol, activo)
       VALUES ($1, $2, $3)`,
      ['Administrador', 'Acceso total a todas las funciones', true]
    );
    console.log('✅ Rol Administrador creado');
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️ Rol Administrador ya existe');
    } else {
      throw error;
    }
  }

  try {
    await client.query(
      `INSERT INTO roles (nombre_rol, descripcion_rol, activo)
       VALUES ($1, $2, $3)`,
      ['Vendedor', 'Acceso a ventas y productos', true]
    );
    console.log('✅ Rol Vendedor creado\n');
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️ Rol Vendedor ya existe\n');
    } else {
      throw error;
    }
  }

  // 3. INSERTAR USUARIOS
  console.log('📝 Paso 3: Insertando Usuarios...\n');

  // Usuario ADMIN
  try {
    const hashAdmin = bcrypt.hashSync('admin123', 10);
    await client.query(
      `INSERT INTO usuarios
       (id_tipo_identificacion, identificacion_usuario, nombres_usuario, apellido1_usuario,
        apellido2_usuario, email_usuario, hash_password_usuario, id_rol, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        1, // CC
        '1234567890',
        'Deisy',
        'Fonegra',
        '',
        'fitcompany@gmail.com',
        hashAdmin,
        1, // Administrador
        true
      ]
    );
    console.log('✅ Usuario ADMIN creado:');
    console.log('   Email: fitcompany@gmail.com');
    console.log('   Password: admin123');
    console.log('   Rol: Administrador\n');
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️ Usuario ADMIN ya existe\n');
    } else {
      throw error;
    }
  }

  // Usuario VENDEDOR
  try {
    const hashVendedor = bcrypt.hashSync('123', 10);
    await client.query(
      `INSERT INTO usuarios
       (id_tipo_identificacion, identificacion_usuario, nombres_usuario, apellido1_usuario,
        apellido2_usuario, email_usuario, hash_password_usuario, id_rol, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        1, // CC
        '0987654321',
        'Luisa',
        'Muñoz',
        '',
        'vendedor@gmail.com',
        hashVendedor,
        2, // Vendedor
        true
      ]
    );
    console.log('✅ Usuario VENDEDOR creado:');
    console.log('   Email: vendedor@gmail.com');
    console.log('   Password: 123');
    console.log('   Rol: Vendedor\n');
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️ Usuario VENDEDOR ya existe\n');
    } else {
      throw error;
    }
  }

  console.log('✅ ¡Seed completado exitosamente!\n');
  console.log('📋 USUARIOS CREADOS:');
  console.log('');
  console.log('ADMIN:');
  console.log('  📧 Email: fitcompany@gmail.com');
  console.log('  🔑 Password: admin123');
  console.log('  👤 Rol: Administrador');
  console.log('');
  console.log('VENDEDOR:');
  console.log('  📧 Email: vendedor@gmail.com');
  console.log('  🔑 Password: 123');
  console.log('  👤 Rol: Vendedor');
  console.log('');

} catch (error) {
  console.error('❌ Error:');
  console.error(error.message);
  console.error('\nDetalles:', error);
  process.exit(1);
} finally {
  await client.end();
}
