-- ============================================
-- Migración 002: Agregar columna abreviatura a tipos_identificacion
-- Fecha: 2024-11-17
-- Descripción: Agregar abreviatura para mostrar en formularios y reportes (ej: CC, CE, NIT)
-- Autor: Equipo FITCOMPANY
-- ============================================

-- Agregar columna abreviatura
ALTER TABLE tipos_identificacion
ADD COLUMN IF NOT EXISTS abreviatura_tipo_identificacion VARCHAR(10);

-- Comentario para documentar
COMMENT ON COLUMN tipos_identificacion.abreviatura_tipo_identificacion IS 'Abreviatura del tipo de identificación (ej: CC, CE, NIT, PAS)';

-- Fin de la migración
