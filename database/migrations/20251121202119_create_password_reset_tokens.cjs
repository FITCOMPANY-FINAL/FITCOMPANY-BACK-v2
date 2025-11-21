/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("password_reset_tokens", (table) => {
    // ID único del token
    table.increments("id_token").primary();

    // FK compuesta al usuario (igual que en ventas/compras)
    table
      .integer("id_tipo_identificacion")
      .unsigned()
      .notNullable()
      .comment("FK: Tipo de identificación del usuario");

    table
      .string("identificacion_usuario", 20)
      .notNullable()
      .comment("FK: Identificación del usuario");

    // Token único generado
    table
      .string("token", 255)
      .notNullable()
      .unique()
      .comment("Token único para recuperación de contraseña");

    // Fecha de expiración (30 minutos desde creación)
    table
      .timestamp("expira_en")
      .notNullable()
      .comment("Fecha y hora de expiración del token");

    // Si el token ya fue usado (un solo uso)
    table
      .boolean("usado")
      .defaultTo(false)
      .notNullable()
      .comment("Indica si el token ya fue utilizado");

    // Fecha de creación
    table
      .timestamp("creado_en")
      .defaultTo(knex.fn.now())
      .notNullable()
      .comment("Fecha y hora de creación del token");

    // Foreign key compuesta a usuarios
    table
      .foreign(["id_tipo_identificacion", "identificacion_usuario"])
      .references(["id_tipo_identificacion", "identificacion_usuario"])
      .inTable("usuarios")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");

    // Índices para mejorar rendimiento
    table.index("token", "idx_token_busqueda");
    table.index("expira_en", "idx_token_expiracion");
    table.index(
      ["id_tipo_identificacion", "identificacion_usuario"],
      "idx_token_usuario",
    );
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("password_reset_tokens");
};
