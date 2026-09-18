const nodemailer = require('nodemailer');
require('dotenv').config();

function getEmailPort() {
    return parseInt(process.env.EMAIL_PORT, 10) || 587;
}

function isEmailConfigured() {
    return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function createMailTransporter() {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: getEmailPort(),
        secure: String(process.env.EMAIL_PORT) === '465',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: true },
    });
}

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = createMailTransporter();
    }
    return transporter;
}

/** Reinicia el transporte (útil si cambian variables de entorno en caliente). */
function resetMailTransporter() {
    transporter = null;
}

const verifyEmailConnection = async () => {
    if (!isEmailConfigured()) {
        return { ok: false, error: 'Faltan EMAIL_HOST, EMAIL_USER o EMAIL_PASS en .env' };
    }
    try {
        await getTransporter().verify();
        return { ok: true };
    } catch (err) {
        const msg = (err.message || '').toLowerCase();
        let hint = '';
        if (msg.includes('invalid login') || msg.includes('authentication failed') || msg.includes('535')) {
            hint =
                ' Gmail: use contraseña de aplicación (App Password). Si tiene espacios, ponga EMAIL_PASS entre comillas en .env.';
        } else if (msg.includes('self signed') || msg.includes('certificate')) {
            hint = ' Problema de certificado TLS.';
        } else if (msg.includes('connect') || msg.includes('timeout') || msg.includes('econnrefused')) {
            hint = ' Verificá firewall/salida al puerto SMTP (587 o 465) desde el servidor.';
        }
        return { ok: false, error: (err.message || 'Error SMTP') + hint };
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envía correo con reintentos ante fallos transitorios de red/SMTP.
 */
const sendMailWithRetry = async (mailOptions, { attempts = 3, delayMs = 1500 } = {}) => {
    if (!isEmailConfigured()) {
        return { ok: false, error: 'Servidor de correo no configurado.' };
    }

    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await getTransporter().sendMail(mailOptions);
            return { ok: true };
        } catch (err) {
            lastError = err;
            console.error(`[MailTransport] Envío ${attempt}/${attempts} falló:`, err.message);
            if (attempt < attempts) {
                await sleep(delayMs * attempt);
                resetMailTransporter();
            }
        }
    }
    return { ok: false, error: lastError?.message || 'Error al enviar.' };
};

module.exports = {
    getTransporter,
    resetMailTransporter,
    isEmailConfigured,
    verifyEmailConnection,
    sendMailWithRetry,
    getEmailPort,
};
