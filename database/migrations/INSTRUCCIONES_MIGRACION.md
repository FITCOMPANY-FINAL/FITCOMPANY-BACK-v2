# 📋 INSTRUCCIONES DE MIGRACIÓN - Password Reset Tokens

## 🎯 Propósito
Crear la tabla `password_reset_tokens` necesaria para la funcionalidad de recuperación de contraseña.

---

## 📦 Archivos Incluidos

1. **`migrations/20251121202119_create_password_reset_tokens.cjs`**
   - Migración de Knex (método recomendado)
   
2. **`migrations/20251121_password_reset_tokens.sql`**
   - Script SQL manual (método alternativo)

---

## 🚀 MÉTODO 1: Usar Knex (Recomendado)

### **Paso 1: Verificar que estás en el proyecto**
```bash
cd /ruta/a/FITCOMPANY-BACKEND-v2
```

### **Paso 2: Ejecutar la migración**
```bash
npx knex migrate:latest
```

### **Paso 3: Verificar que se creó la tabla**
```bash
npx knex migrate:status
```

Deberías ver algo como:
```
✅ 20251121202119_create_password_reset_tokens.cjs [Ran]
```

### **Paso 4: Verificar en PostgreSQL**
```bash
psql -h localhost -U postgres -d gimnasio_db -c "\dt password_reset_tokens"
```

---

## 🛠️ MÉTODO 2: Usar SQL Manual (Alternativo)

Si Knex no funciona, puedes ejecutar el SQL directamente:

### **Paso 1: Conectarse a PostgreSQL**
```bash
psql -h localhost -U postgres -d gimnasio_db
```

### **Paso 2: Ejecutar el archivo SQL**
```bash
\i /ruta/completa/a/database/migrations/20251121_password_reset_tokens.sql
```

O desde la terminal directamente:
```bash
psql -h localhost -U postgres -d gimnasio_db -f database/migrations/20251121_password_reset_tokens.sql
```

---

## ✅ Verificación

### **1. Ver estructura de la tabla**
```sql
\d password_reset_tokens
```

**Deberías ver:**
- 7 columnas: `id_token`, `id_tipo_identificacion`, `identificacion_usuario`, `token`, `expira_en`, `usado`, `creado_en`
- 1 Primary Key: `id_token`
- 3 Índices: `idx_token_busqueda`, `idx_token_expiracion`, `idx_token_usuario`
- 1 Foreign Key a `usuarios`

### **2. Ver todas las tablas**
```sql
\dt
```

Deberías ver `password_reset_tokens` en la lista.

### **3. Contar registros (debe ser 0)**
```sql
SELECT COUNT(*) FROM password_reset_tokens;
```

---

## 🔄 Rollback (Deshacer cambios)

### **Con Knex:**
```bash
npx knex migrate:rollback
```

### **Con SQL:**
```sql
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
```

---

## 📊 Descripción de la Tabla

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_token` | SERIAL | ID único del token (autoincremental) |
| `id_tipo_identificacion` | INTEGER | FK - Tipo de identificación del usuario |
| `identificacion_usuario` | VARCHAR(20) | FK - Identificación del usuario |
| `token` | VARCHAR(255) | Token único generado (único en toda la tabla) |
| `expira_en` | TIMESTAMP | Fecha/hora de expiración (30 min desde creación) |
| `usado` | BOOLEAN | Si el token ya fue usado (un solo uso) |
| `creado_en` | TIMESTAMP | Fecha/hora de creación automática |

### **Relaciones:**
- **FK Compuesta:** `(id_tipo_identificacion, identificacion_usuario)` → `usuarios`
- **ON DELETE CASCADE:** Si se elimina el usuario, se eliminan sus tokens
- **ON UPDATE CASCADE:** Si se actualiza el usuario, se actualizan sus tokens

---

## ⚠️ Problemas Comunes

### **Error: "relation already exists"**
La tabla ya fue creada. Puedes verificar con:
```sql
SELECT * FROM password_reset_tokens;
```

### **Error: "permission denied"**
Asegúrate de usar el usuario correcto:
```bash
psql -h localhost -U postgres -d gimnasio_db
```

### **Error: "database does not exist"**
Verifica que la base de datos se llame `gimnasio_db`:
```bash
psql -h localhost -U postgres -l
```

---

## 📝 Notas

- Esta migración es **segura de ejecutar múltiples veces** (usa `IF NOT EXISTS`)
- Los tokens expiran después de **30 minutos**
- Cada token puede usarse **solo una vez**
- Los tokens se eliminan automáticamente si el usuario es eliminado

---

## ✅ Checklist Post-Migración

- [ ] Tabla `password_reset_tokens` creada
- [ ] 7 columnas presentes
- [ ] 4 índices creados (3 + unique en token)
- [ ] Foreign key a `usuarios` configurada
- [ ] Tabla vacía (0 registros)
- [ ] Sin errores en la consola

---

## 🆘 Necesitas Ayuda?

Si tienes problemas:
1. Verifica que PostgreSQL esté corriendo
2. Verifica las credenciales de conexión
3. Revisa los logs de error
4. Contacta al equipo de desarrollo

---

**Fecha de creación:** 2024-11-21  
**Versión:** 1.0  
**Autor:** Sistema de Migraciones
