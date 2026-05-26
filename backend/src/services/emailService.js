const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

function isEmailConfigured() {
    return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

const sendActivationEmail = async (to, token) => {
    if (!isEmailConfigured()) {
        console.error('[EmailService] SMTP no configurado (EMAIL_HOST, EMAIL_USER, EMAIL_PASS).');
        return { ok: false, error: 'Servidor de correo no configurado.' };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://bacarsa.dyndns.org:8001';
    const activationUrl = `${frontendUrl}/activate-account?token=${token}`;

    const mailOptions = {
        from: `"Sistema de Tickets BACAR" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Activa tu cuenta en el Sistema de Tickets de Grupo Bacar',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>¡Bienvenido al Sistema de Tickets de Grupo Bacar!</h2>
                <p>Gracias por registrarte. Por favor, haz clic en el siguiente botón para activar tu cuenta:</p>
                <a href="${activationUrl}" style="background-color: #DC2626; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold;">
                    Activar Mi Cuenta
                </a>
                <p style="margin-top: 20px;">Si el botón no funciona, copia y pega esta URL en tu navegador:</p>
                <p><a href="${activationUrl}">${activationUrl}</a></p>
                <p>Este enlace expirará en 8 horas.</p>
                <p>Si no te registraste en nuestro sistema, por favor ignora este correo.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Correo de activación enviado a ${to}`);
        return { ok: true };
    } catch (error) {
        console.error('[EmailService] Error al enviar el correo de activación:', error.message);
        return { ok: false, error: error.message };
    }
};

const sendWelcomeEmail = async (to, username) => {
    if (!isEmailConfigured()) {
        return { ok: false, error: 'Servidor de correo no configurado.' };
    }

    const loginUrl = `${process.env.FRONTEND_URL || 'http://bacarsa.dyndns.org:8001'}/login`;

    const mailOptions = {
        from: `"Sistema de Tickets de Grupo Bacar" <${process.env.EMAIL_USER}>`,
        to,
        subject: '¡Tu cuenta ha sido activada!',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>¡Tu cuenta está lista!</h2>
                <p>Hola,</p>
                <p>Tu cuenta en el Sistema de Tickets de Grupo Bacar ha sido activada exitosamente.</p>
                <p>Tu nombre de usuario es: <strong>${username}</strong></p>
                <p>Ya puedes iniciar sesión con tu correo y la contraseña que elegiste.</p>
                <a href="${loginUrl}" style="background-color: #16A34A; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold;">
                    Iniciar Sesión
                </a>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Correo de bienvenida enviado a ${to}`);
        return { ok: true };
    } catch (error) {
        console.error('[EmailService] Error al enviar el correo de bienvenida:', error.message);
        return { ok: false, error: error.message };
    }
};

const sendSupplierInvitationEmail = async (to, companyName, invitationUrl) => {
    if (!isEmailConfigured()) {
        return { ok: false, error: 'Servidor de correo no configurado.' };
    }

    const mailOptions = {
        from: `"Compras - Grupo Bacar" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Invitación como Proveedor - Portal de Compras BACAR',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Invitación al Portal de Proveedores</h2>
                <p>Estimado proveedor${companyName ? ` de ${companyName}` : ''},</p>
                <p>Ha sido registrado como proveedor en el Sistema de Compras de Grupo Bacar.</p>
                <p>Haga clic en el siguiente enlace para establecer su contraseña y acceder al portal:</p>
                <a href="${invitationUrl}" style="background-color: #DC2626; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 8px; font-weight: bold;">
                    Establecer contraseña
                </a>
                <p style="margin-top: 20px;">Este enlace expirará en 72 horas.</p>
                <p>Si no esperaba este correo, ignórelo.</p>
            </div>
        `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Invitación enviada a proveedor ${to}`);
        return { ok: true };
    } catch (error) {
        console.error('[EmailService] Error al enviar invitación:', error.message);
        return { ok: false, error: error.message };
    }
};

module.exports = {
    sendActivationEmail,
    sendWelcomeEmail,
    sendSupplierInvitationEmail,
    isEmailConfigured,
};
