import nodemailer from "nodemailer";
import "dotenv/config";

/**
 * Configuración del transportador de correo usando Gmail
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Verifica la conexión con el servidor de correo
 */
export const verificarConexionEmail = async () => {
  try {
    await transporter.verify();
    console.log("✅ Servidor de email listo para enviar mensajes");
    return true;
  } catch (error) {
    console.error("❌ Error al conectar con servidor de email:", error.message);
    return false;
  }
};

/**
 * Envía un email de recuperación de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} nombre - Nombre del usuario
 * @param {string} token - Token de recuperación
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
export const enviarEmailRecuperacion = async (email, nombre, token) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "🔐 Recuperación de Contraseña - FitCompany",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              margin: 20px 0;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
            }
            .button:hover {
              background-color: #45a049;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 10px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>FitCompany</h1>
            </div>
            <div class="content">
              <h2>Hola ${nombre},</h2>
              <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
              <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
              <center>
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              </center>
              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; color: #666;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Este enlace expirará en <strong>30 minutos</strong></li>
                  <li>Solo puede ser usado <strong>una vez</strong></li>
                  <li>Si no solicitaste este cambio, ignora este correo</li>
                </ul>
              </div>
              <p>Si tienes algún problema, contacta con el administrador del sistema.</p>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>&copy; 2024 FitCompany. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hola ${nombre},

        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.

        Para crear una nueva contraseña, visita el siguiente enlace:
        ${resetUrl}

        IMPORTANTE:
        - Este enlace expirará en 30 minutos
        - Solo puede ser usado una vez
        - Si no solicitaste este cambio, ignora este correo

        Saludos,
        Equipo FitCompany
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de recuperación enviado a: ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Error al enviar email de recuperación:", error.message);
    throw new Error("Error al enviar el correo electrónico");
  }
};

/**
 * Envía un email de confirmación de cambio de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} nombre - Nombre del usuario
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
export const enviarEmailCambioExitoso = async (email, nombre) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "✅ Contraseña Actualizada - FitCompany",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .success {
              background-color: #d4edda;
              border-left: 4px solid #28a745;
              padding: 10px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>FitCompany</h1>
            </div>
            <div class="content">
              <h2>Hola ${nombre},</h2>
              <div class="success">
                <p><strong>✅ Tu contraseña ha sido actualizada exitosamente</strong></p>
              </div>
              <p>Este correo es para confirmar que tu contraseña fue cambiada recientemente.</p>
              <p><strong>Si realizaste este cambio, no necesitas hacer nada más.</strong></p>
              <p><strong>Si NO realizaste este cambio,</strong> contacta inmediatamente con el administrador del sistema, ya que tu cuenta podría estar comprometida.</p>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>&copy; 2024 FitCompany. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hola ${nombre},

        Tu contraseña ha sido actualizada exitosamente.

        Si realizaste este cambio, no necesitas hacer nada más.
        Si NO realizaste este cambio, contacta inmediatamente con el administrador del sistema.

        Saludos,
        Equipo FitCompany
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmación enviado a: ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Error al enviar email de confirmación:", error.message);
    // No lanzamos error aquí porque el cambio de contraseña ya se hizo
    return false;
  }
};
