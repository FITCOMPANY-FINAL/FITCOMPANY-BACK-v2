-- ============================================
-- SCRIPT DE INSERCIÓN: FORMULARIOS (MENÚ DINÁMICO)
-- ============================================
-- Este script crea la estructura de menú para el sistema de gimnasio
-- Estructura: Padres (menús principales) → Hijos (submenús/opciones)
--
-- IMPORTANTE: Ejecutar UNA SOLA VEZ después de crear el schema inicial
--
-- NOTA: Los IDs se asignan automáticamente (SERIAL)
-- Esto facilita el CRUD posterior sin problemas de secuencias
-- ============================================

-- Limpiar datos existentes (solo si es necesario reiniciar)
-- DESCOMENTAR SOLO SI NECESITAS REINICIAR LOS DATOS
-- DELETE FROM formularios;
-- ALTER SEQUENCE formularios_id_formulario_seq RESTART WITH 1;

-- ============================================
-- PASO 1: INSERTAR GRUPOS PRINCIPALES (PADRES)
-- ============================================
-- Los IDs se asignarán automáticamente: 1, 2, 3, 4, 5

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Seguridad', NULL, NULL, TRUE, 1);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Inventario', NULL, NULL, TRUE, 2);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Operaciones', NULL, NULL, TRUE, 3);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Reportes', NULL, NULL, TRUE, 4);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Gestión de Usuarios', NULL, NULL, TRUE, 5);

-- ============================================
-- PASO 2: INSERTAR HIJOS DE SEGURIDAD (padre_id = 1)
-- ============================================

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Formularios', '/dashboard/formularios', 1, FALSE, 1);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Permisos', '/dashboard/permisos', 1, FALSE, 2);

-- ============================================
-- PASO 3: INSERTAR HIJOS DE INVENTARIO (padre_id = 2)
-- ============================================

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Categorías', '/dashboard/categorias', 2, FALSE, 1);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Unidades de Medida', '/dashboard/unidades-medidas', 2, FALSE, 2);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Productos', '/dashboard/productos', 2, FALSE, 3);

-- ============================================
-- PASO 4: INSERTAR HIJOS DE OPERACIONES (padre_id = 3)
-- ============================================

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Compras', '/dashboard/compras', 3, FALSE, 1);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Ventas', '/dashboard/ventas', 3, FALSE, 2);

-- ============================================
-- PASO 5: INSERTAR HIJOS DE REPORTES (padre_id = 4)
-- ============================================

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Reporte de Ventas', '/dashboard/reportes/ventas', 4, FALSE, 1);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Reporte de Compras', '/dashboard/reportes/compras', 4, FALSE, 2);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Reporte de Inventario', '/dashboard/reportes/inventario', 4, FALSE, 3);

-- ============================================
-- PASO 6: INSERTAR HIJOS DE GESTIÓN DE USUARIOS (padre_id = 5)
-- ============================================

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Roles', '/dashboard/roles', 5, FALSE, 1);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Usuarios', '/dashboard/usuarios', 5, FALSE, 2);

INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Tipos de Identificación', '/dashboard/tipos-identificaciones', 5, FALSE, 3);

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Mostrar resumen de formularios insertados
SELECT
    CASE WHEN is_padre THEN '📁 PADRE' ELSE '  📄 HIJO' END AS tipo,
    id_formulario,
    titulo_formulario,
    COALESCE(url_formulario, '(sin URL)') AS url,
    COALESCE(padre_id::TEXT, '-') AS padre_id,
    orden_formulario
FROM formularios
ORDER BY
    COALESCE(padre_id, id_formulario),
    orden_formulario;

-- Contar padres e hijos
SELECT
    is_padre,
    COUNT(*) as total,
    CASE
        WHEN is_padre THEN 'Menús principales (padres)'
        ELSE 'Submenús (hijos)'
    END AS descripcion
FROM formularios
GROUP BY is_padre
ORDER BY is_padre DESC;

-- Verificar que todos los hijos tienen padres válidos
SELECT
    'Validación: Todos los hijos tienen padres válidos' AS check_name,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ OK'
        ELSE '❌ ERROR: Hay hijos con padre_id inválido'
    END AS resultado
FROM formularios f
WHERE f.is_padre = FALSE
  AND f.padre_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM formularios p
    WHERE p.id_formulario = f.padre_id
      AND p.is_padre = TRUE
  );

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
SELECT '✅ Formularios insertados correctamente' AS resultado;
