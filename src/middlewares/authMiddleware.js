// BACK/src/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

/**
 * Lee el JWT del header Authorization: Bearer <token>
 * Verifica la firma y exp, y expone los datos en req.user
 */
export function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [type, token] = auth.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Falta token" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { ...payload };

    const email =
      payload.email ?? payload.correo ?? payload.usuario ?? payload.user ?? null;

    const tipo_id_raw =
      payload.tipo_id ??
      payload.tipoIdentificacion ??
      payload.tipo_identificacion ??
      payload.tipo ??
      null;

    const tipo_id = tipo_id_raw != null ? Number(tipo_id_raw) : null;

    // No forzamos a que existan aquí; el controller ya valida con getAuthUser()
    if (email != null) req.user.email = email;
    if (tipo_id != null && !Number.isNaN(tipo_id)) req.user.tipo_id = tipo_id;

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}
