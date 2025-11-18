# Migraciones de Base de Datos

Este directorio contiene las migraciones incrementales de la base de datos PostgreSQL.

## 📋 Orden de Ejecución

### Para configuración inicial (primera vez):

1. **Primero:** Ejecutar el schema inicial
   ```bash
   psql -U postgres -d gimnasio_db -f database/schema-initial.sql
   ```

2. **Después:** Ejecutar las migraciones en orden numérico
   ```bash
   psql -U postgres -d gimnasio_db -f database/migrations/001-add-activo-columns.sql
   ```

---

## 🔧 Comandos para gestionar migraciones

### **En Windows (PowerShell o CMD):**

```powershell
# Ejecutar schema inicial
psql -U postgres -d gimnasio_db -f database/schema-initial.sql

# Ejecutar una migración específica
psql -U postgres -d gimnasio_db -f database/migrations/001-add-activo-columns.sql

# Ejecutar todas las migraciones
Get-ChildItem database\migrations\*.sql | ForEach-Object { psql -U postgres -d gimnasio_db -f $_.FullName }
```

### **En macOS/Linux (Terminal):**

```bash
# Ejecutar schema inicial
psql -U postgres -d gimnasio_db -f database/schema-initial.sql

# Ejecutar una migración específica
psql -U postgres -d gimnasio_db -f database/migrations/001-add-activo-columns.sql

# Ejecutar todas las migraciones
for file in database/migrations/*.sql; do psql -U postgres -d gimnasio_db -f "$file"; done
```

---

## 📝 Crear nueva migración

### **Paso 1: Crear archivo**

**Windows (PowerShell):**
```powershell
# Crear nuevo archivo de migración
New-Item -Path "database\migrations\002-nombre-descriptivo.sql" -ItemType File
```

**macOS/Linux (Terminal):**
```bash
# Crear nuevo archivo de migración
touch database/migrations/002-nombre-descriptivo.sql
```

### **Paso 2: Editar archivo**

Abre el archivo y agrega tu migración siguiendo este formato:

```sql
-- ============================================
-- Migración 002: Descripción de qué hace
-- Fecha: YYYY-MM-DD
-- Descripción: Detalles adicionales
-- ============================================

-- Tus comandos SQL aquí
ALTER TABLE nombre_tabla ADD COLUMN nueva_columna tipo;

-- Comentarios para documentar
COMMENT ON COLUMN nombre_tabla.nueva_columna IS 'Descripción de la columna';

-- Fin de la migración
```

### **Paso 3: Ejecutar migración**

**Windows:**
```powershell
psql -U postgres -d gimnasio_db -f database\migrations\002-nombre-descriptivo.sql
```

**macOS/Linux:**
```bash
psql -U postgres -d gimnasio_db -f database/migrations/002-nombre-descriptivo.sql
```

---

## ⚠️ Reversar una migración

Si necesitas revertir cambios, crea una nueva migración que deshaga los cambios:

**Ejemplo:**
```sql
-- Migración 003: Revertir cambios de migración 002
DROP COLUMN IF EXISTS nueva_columna FROM nombre_tabla;
```

**NO intentes eliminar archivos de migración ya ejecutados.**

---

## 📊 Historial de Migraciones

| # | Archivo | Fecha | Descripción |
|---|---------|-------|-------------|
| 001 | `001-add-activo-columns.sql` | 2024-11-17 | Agregar columna `activo` a tablas maestras (tipos_identificacion, roles, unidades_medida) para soporte de soft delete futuro |

---

## 💡 Notas Importantes

- ✅ Las migraciones usan `IF NOT EXISTS` para evitar errores si se ejecutan múltiples veces
- ✅ Siempre hacer backup antes de ejecutar migraciones en producción
- ✅ Los UPDATE establecen registros existentes con valores por defecto
- ✅ Las columnas `activo` están listas para implementar soft delete en el futuro
- ⚠️ Actualmente los controladores usan DELETE físico, la columna `activo` se usará en versión futura

---

## 🔍 Verificar estado de las migraciones

**Windows/macOS/Linux:**
```bash
# Ver estructura de una tabla
psql -U postgres -d gimnasio_db -c "\d nombre_tabla"

# Ver todas las tablas
psql -U postgres -d gimnasio_db -c "\dt"

# Ver columnas de todas las tablas
psql -U postgres -d gimnasio_db -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position;"
```

---

## 📞 Ayuda

Si tienes problemas con las migraciones:
1. Verifica que PostgreSQL esté corriendo
2. Verifica las credenciales (usuario: `postgres`, base de datos: `gimnasio_db`)
3. Revisa los logs de error del comando psql
4. Consulta la documentación de PostgreSQL: https://www.postgresql.org/docs/
