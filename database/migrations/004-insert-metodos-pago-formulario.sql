-- ============================================
-- Migración 004: Insertar formulario Métodos de Pago
-- Fecha: 2025-11-23
-- Descripción: Agregar el formulario "Métodos de Pago" a la tabla formularios como hijo de Operaciones
-- Autor: Equipo FITCOMPANY
-- ============================================

-- Insertar el formulario "Métodos de Pago" como hijo de Operaciones (padre_id = 3)
INSERT INTO formularios (titulo_formulario, url_formulario, padre_id, is_padre, orden_formulario)
VALUES ('Métodos de Pago', '/dashboard/metodos-pago', 3, FALSE, 3)
ON CONFLICT DO NOTHING;

-- Fin de la migración
