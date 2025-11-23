-- ============================================
-- Migración 003: Agregar campos de soft delete a tabla ventas
-- Fecha: 2024-11-23
-- Descripción: Agregar soporte para eliminación lógica con auditoría en ventas
-- Autor: Equipo FITCOMPANY
-- ============================================

-- Verificar si las columnas ya existen antes de agregarlas
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS eliminado_por VARCHAR(255) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(500) NULL DEFAULT NULL;

-- Comentarios para documentar los cambios
COMMENT ON COLUMN ventas.activo IS 'Indica si la venta está activa (FALSE = soft delete)';
COMMENT ON COLUMN ventas.eliminado_en IS 'Timestamp de cuándo se marcó como eliminada';
COMMENT ON COLUMN ventas.eliminado_por IS 'Usuario que marcó la venta como eliminada (tipo_id-identificacion)';
COMMENT ON COLUMN ventas.motivo_eliminacion IS 'Motivo por el cual se eliminó la venta';

-- Establecer todas las ventas existentes como activas
UPDATE ventas SET activo = TRUE WHERE activo IS NULL;

-- Crear índice para búsquedas rápidas por estado activo
CREATE INDEX IF NOT EXISTS idx_ventas_activo ON ventas(activo);

-- Fin de la migración
