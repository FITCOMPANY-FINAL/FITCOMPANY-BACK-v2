-- ============================================
-- Migración 001: Agregar columna activo a tablas maestras
-- Fecha: 2024-11-17
-- Descripción: Agregar soporte para soft delete en tablas de catálogo
-- Autor: Equipo FITCOMPANY
-- ============================================

-- Agregar columna activo a tipos_identificacion
ALTER TABLE tipos_identificacion
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE NOT NULL;

-- Agregar columna activo a roles
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE NOT NULL;

-- Agregar columna activo a unidades_medida
ALTER TABLE unidades_medida
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE NOT NULL;

-- Establecer todos los registros existentes como activos
UPDATE tipos_identificacion SET activo = TRUE WHERE activo IS NULL;
UPDATE roles SET activo = TRUE WHERE activo IS NULL;
UPDATE unidades_medida SET activo = TRUE WHERE activo IS NULL;

-- Comentarios para documentar el cambio
COMMENT ON COLUMN tipos_identificacion.activo IS 'Indica si el tipo de identificación está activo (soft delete)';
COMMENT ON COLUMN roles.activo IS 'Indica si el rol está activo (soft delete)';
COMMENT ON COLUMN unidades_medida.activo IS 'Indica si la unidad de medida está activa (soft delete)';

-- Fin de la migración
