const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ruta donde se guardarán los archivos.
const uploadDir = 'uploads/';

// Asegurarse de que el directorio de subida exista.
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuración de almacenamiento de Multer (sin cambios).
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configuración de Multer.
const upload = multer({
    storage: storage,
    limits: {
        // ✅ MODIFICACIÓN: Límite aumentado a 50MB para soportar videos.
        // Ajusta este valor si necesitas más (ej. 100MB = 1024 * 1024 * 100).
        fileSize: 1024 * 1024 * 50 // Límite de 50 MB por archivo
    },
    fileFilter: (req, file, cb) => {
        // ✅ MODIFICACIÓN: Lógica de filtro mejorada y se añaden tipos de video.

        // 1. Definir extensiones permitidas (incluyendo el punto)
        const allowedExts = [
            '.jpeg', '.jpg', '.png', '.gif',
            '.webp', '.heic', '.heif', '.avif', // Capturas de pantalla y fotos de iPhone
            '.pdf', '.doc', '.docx', '.xls', '.xlsx',
            '.mp4', '.mov', '.avi', '.wmv', '.mkv' // Extensiones de video
        ];
        
        // 2. Definir MIME types permitidos
        const allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/heic',
            'image/heif',
            'image/avif',
            'application/pdf',
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel', // .xls
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'video/mp4',
            'video/quicktime', // .mov
            'video/x-msvideo', // .avi
            'video/x-matroska', // .mkv
            'video/x-ms-wmv' // .wmv
        ];

        // 3. Chequear extensión y MIME type
        const ext = path.extname(file.originalname).toLowerCase();
        const extMatch = allowedExts.includes(ext);
        const mimeMatch = allowedMimeTypes.includes(file.mimetype);

        // Algunos navegadores no reportan MIME para HEIC/HEIF: alcanza la extensión.
        const genericMime = !file.mimetype || file.mimetype === 'application/octet-stream';

        if (extMatch && (mimeMatch || genericMime)) {
            // Archivo aceptado
            return cb(null, true);
        }
        
        // Archivo rechazado
        cb(new Error(`El archivo "${file.originalname}" no tiene un formato soportado (${file.mimetype || 'desconocido'}).`));
    }
});

/**
 * Traduce los errores de multer a un mensaje entendible para el usuario.
 */
const describeUploadError = (err, maxFiles) => {
    if (err instanceof multer.MulterError) {
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                return 'Cada archivo puede pesar hasta 50 MB.';
            case 'LIMIT_FILE_COUNT':
            case 'LIMIT_UNEXPECTED_FILE':
                return maxFiles
                    ? `Se pueden adjuntar hasta ${maxFiles} archivos por vez.`
                    : 'Se adjuntaron más archivos de los permitidos.';
            case 'LIMIT_FIELD_VALUE':
                return 'El texto es demasiado largo. Probá con menos contenido pegado.';
            default:
                return `No se pudo procesar el adjunto (${err.code}).`;
        }
    }
    return err.message || 'No se pudo procesar el adjunto.';
};

/**
 * Envuelve un middleware de multer para responder 400 con el motivo real
 * en lugar de un 500 sin información.
 */
const withUploadErrors = (middleware, maxFiles) => (req, res, next) => {
    middleware(req, res, (err) => {
        if (!err) return next();
        console.error(`[Upload] ${req.method} ${req.originalUrl} rechazado:`, err.message);
        res.status(400);
        next(new Error(describeUploadError(err, maxFiles)));
    });
};

// Multer en memoria para Firebase Storage (facturas de proveedores)
const memoryStorage = multer.memoryStorage();
const uploadToMemory = multer({
    storage: memoryStorage,
    limits: { fileSize: 1024 * 1024 * 10 }, // 10MB para facturas
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (allowed.includes(ext)) return cb(null, true);
        cb(new Error('Solo se permiten PDF, JPG, JPEG, PNG, GIF o WEBP para el comprobante.'));
    }
});

const uploadBudgetPdf = multer({
    storage: memoryStorage,
    limits: { fileSize: 1024 * 1024 * 10 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext === '.pdf') return cb(null, true);
        cb(new Error('Solo se permite PDF para el presupuesto oficial.'));
    }
});

module.exports = upload;
module.exports.uploadToMemory = uploadToMemory;
module.exports.uploadBudgetPdf = uploadBudgetPdf;
module.exports.withUploadErrors = withUploadErrors;
