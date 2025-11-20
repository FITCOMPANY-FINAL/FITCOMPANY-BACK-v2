# 📋 Paso a Paso: Ejecutar schema-initial.sql

Esta guía te ayudará a ejecutar el archivo `database/schema-initial.sql` para crear todas las tablas de la base de datos.

---

## 🔍 Paso 1: Verificar que PostgreSQL esté instalado y corriendo

### En Windows:
1. Abre el **Administrador de tareas** (Ctrl + Shift + Esc)
2. Ve a la pestaña **Servicios**
3. Busca **postgresql** o **PostgreSQL**
4. Verifica que esté **En ejecución**

Si no está corriendo:
- Busca "Servicios" en el menú de Windows
- Encuentra el servicio de PostgreSQL
- Haz clic derecho → **Iniciar**

### Verificar desde la terminal:
```powershell
# Verificar si psql está disponible
psql --version
```

Si no aparece, PostgreSQL puede no estar en el PATH. No te preocupes, puedes usar otras opciones.

---

## 📝 Paso 2: Crear o verificar el archivo .env

1. Ve a la carpeta `FITCOMPANY-BACK-v2`
2. Verifica si existe un archivo llamado `.env`
3. Si no existe, créalo (puede estar oculto, así que asegúrate de mostrar archivos ocultos)

### Contenido del archivo .env:

```env
# Configuración de PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gimnasio_db
DB_USER=postgres
DB_PASSWORD=tu_contraseña_de_postgres

# Puerto del servidor (opcional)
PORT=3000
```

**⚠️ IMPORTANTE:** Reemplaza `tu_contraseña_de_postgres` con la contraseña real de tu usuario de PostgreSQL.

---

## 🗄️ Paso 3: Crear la base de datos (si no existe)

Tienes 3 opciones:

### Opción A: Usando psql (línea de comandos)

Abre PowerShell o CMD y ejecuta:

```powershell
# Conectarte a PostgreSQL (te pedirá la contraseña)
psql -U postgres

# Dentro de psql, ejecuta:
CREATE DATABASE gimnasio_db;

# Salir de psql
\q
```

### Opción B: Usando pgAdmin (interfaz gráfica)

1. Abre **pgAdmin**
2. Conéctate a tu servidor PostgreSQL
3. Haz clic derecho en **Databases** → **Create** → **Database**
4. Nombre: `gimnasio_db`
5. Haz clic en **Save**

### Opción C: Desde la terminal en una sola línea

```powershell
psql -U postgres -c "CREATE DATABASE gimnasio_db;"
```

---

## 🚀 Paso 4: Ejecutar el schema-initial.sql

Tienes 3 opciones para ejecutar el archivo:

---

### ✅ OPCIÓN 1: Usando psql (Recomendado - Más simple)

**En PowerShell o CMD:**

```powershell
# Navegar a la carpeta del proyecto
cd "C:\Users\Tomi\Desktop\°UNIVERSIDAD\NWGYM\FITCOMPANY-BACK-v2"

# Ejecutar el schema (te pedirá la contraseña)
psql -U postgres -d gimnasio_db -f database\schema-initial.sql
```

**Si tienes problemas con la ruta, usa la ruta completa:**

```powershell
psql -U postgres -d gimnasio_db -f "C:\Users\Tomi\Desktop\°UNIVERSIDAD\NWGYM\FITCOMPANY-BACK-v2\database\schema-initial.sql"
```

**Si quieres evitar escribir la contraseña cada vez, usa la variable de entorno:**

```powershell
# Windows PowerShell
$env:PGPASSWORD="tu_contraseña"
psql -U postgres -d gimnasio_db -f database\schema-initial.sql
```

---

### ✅ OPCIÓN 2: Usando pgAdmin (Interfaz gráfica)

1. Abre **pgAdmin**
2. Conéctate a tu servidor PostgreSQL
3. Expande tu servidor → **Databases** → **gimnasio_db**
4. Haz clic derecho en **gimnasio_db** → **Query Tool**
5. En el editor, haz clic en el ícono de **carpeta** (Abrir archivo)
6. Selecciona: `FITCOMPANY-BACK-v2\database\schema-initial.sql`
7. Haz clic en el botón **▶ Ejecutar** (o presiona F5)

---

### ✅ OPCIÓN 3: Usando DBeaver u otra herramienta

1. Abre **DBeaver** (o tu herramienta favorita)
2. Conéctate a PostgreSQL → base de datos `gimnasio_db`
3. Abre el archivo `database/schema-initial.sql`
4. Selecciona todo el contenido (Ctrl + A)
5. Ejecuta el script (F5 o botón de ejecutar)

---

## ✅ Paso 5: Verificar que funcionó

### Verificar desde psql:

```powershell
# Conectarte a la base de datos
psql -U postgres -d gimnasio_db

# Dentro de psql, listar todas las tablas:
\dt

# Deberías ver tablas como:
# - tipos_identificacion
# - roles
# - usuarios
# - productos
# - ventas
# - compras
# etc.

# Salir de psql
\q
```

### Verificar desde pgAdmin:

1. Abre pgAdmin
2. Navega a: **Servidor** → **Databases** → **gimnasio_db** → **Schemas** → **public** → **Tables**
3. Deberías ver todas las tablas creadas

### Verificar ejecutando el servidor:

```powershell
# En la carpeta del proyecto
npm start
```

Si el servidor inicia sin errores de conexión, ¡todo está bien! 🎉

---

## ❌ Solución de Problemas Comunes

### Error: "psql: no se reconoce como comando"
**Solución:** PostgreSQL no está en el PATH. Usa **pgAdmin** o **DBeaver** (Opción 2 o 3).

### Error: "database does not exist"
**Solución:** Crea la base de datos primero (Paso 3).

### Error: "password authentication failed"
**Solución:** 
- Verifica que la contraseña en `.env` sea correcta
- O usa `psql` directamente y escribe la contraseña cuando te la pida

### Error: "could not connect to server"
**Solución:** 
- Verifica que PostgreSQL esté corriendo (Paso 1)
- Verifica que el puerto sea 5432 (o el que configuraste)

### Error: "permission denied"
**Solución:** Asegúrate de usar un usuario con permisos (normalmente `postgres`).

### Error con caracteres especiales en la ruta (como °UNIVERSIDAD)
**Solución:** Usa comillas alrededor de la ruta completa:
```powershell
psql -U postgres -d gimnasio_db -f "C:\Users\Tomi\Desktop\°UNIVERSIDAD\NWGYM\FITCOMPANY-BACK-v2\database\schema-initial.sql"
```

---

## 📌 Resumen Rápido

1. ✅ PostgreSQL corriendo
2. ✅ Archivo `.env` configurado
3. ✅ Base de datos `gimnasio_db` creada
4. ✅ Ejecutar: `psql -U postgres -d gimnasio_db -f database\schema-initial.sql`
5. ✅ Verificar con `\dt` en psql o iniciando el servidor

---

## 💡 Tip Extra

Si vas a ejecutar el schema múltiples veces (desarrollo), no hay problema. El script usa `DROP TABLE IF EXISTS`, así que es seguro ejecutarlo varias veces. Solo recuerda que **se eliminarán todos los datos existentes**.

---

¿Necesitas ayuda con algún paso específico? ¡Dímelo!


