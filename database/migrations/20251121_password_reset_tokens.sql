-- ============================================
-- MIGRACIÓN: Tabla password_reset_tokens
-- Descripción: Tabla para tokens de recuperación de contraseña
-- Fecha: 2024-11-21
-- Autor: Sistema de Migraciones
-- ============================================

-- CREAR TABLA
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id_token SERIAL PRIMARY KEY,
  id_tipo_identificacion INTEGER NOT NULL,
  identificacion_usuario VARCHAR(20) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expira_en TIMESTAMP NOT NULL,
  usado BOOLEAN DEFAULT false NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Foreign Key Compuesta
  CONSTRAINT fk_password_reset_usuario
    FOREIGN KEY (id_tipo_identificacion, identificacion_usuario)
    REFERENCES usuarios(id_tipo_identificacion, identificacion_usuario)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- COMENTARIOS DE COLUMNAS
COMMENT ON TABLE password_reset_tokens IS 'Tokens para recuperación de contraseña';
COMMENT ON COLUMN password_reset_tokens.id_token IS 'ID único del token';
COMMENT ON COLUMN password_reset_tokens.id_tipo_identificacion IS 'FK: Tipo de identificación del usuario';
COMMENT ON COLUMN password_reset_tokens.identificacion_usuario IS 'FK: Identificación del usuario';
COMMENT ON COLUMN password_reset_tokens.token IS 'Token único para recuperación de contraseña';
COMMENT ON COLUMN password_reset_tokens.expira_en IS 'Fecha y hora de expiración del token (30 minutos)';
COMMENT ON COLUMN password_reset_tokens.usado IS 'Indica si el token ya fue utilizado (un solo uso)';
COMMENT ON COLUMN password_reset_tokens.creado_en IS 'Fecha y hora de creación del token';

-- ÍNDICES
CREATE INDEX idx_token_busqueda ON password_reset_tokens(token);
CREATE INDEX idx_token_expiracion ON password_reset_tokens(expira_en);
CREATE INDEX idx_token_usuario ON password_reset_tokens(id_tipo_identificacion, identificacion_usuario);

-- VERIFICAR CREACIÓN
SELECT
  'Tabla password_reset_tokens creada correctamente' as mensaje,
  COUNT(*) as registros
FROM password_reset_tokens;

-- ============================================
-- ROLLBACK (Si necesitas deshacer los cambios)
-- ============================================
-- DROP TABLE IF EXISTS password_reset_tokens CASCADE;
