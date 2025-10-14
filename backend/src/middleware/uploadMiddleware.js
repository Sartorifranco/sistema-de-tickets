// backend/src/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ruta donde se guardarán los archivos.
const uploadDir = 'uploads/';

// Asegurarse de que el directorio de subida exista.
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuración de almacenamiento de Multer.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Guardar archivos en la carpeta 'uploads/'
    },
    filename: (req, file, cb) => {
        // Crear un nombre de archivo único para evitar colisiones.
        // Formato: timestamp-nombreOriginalDelArchivo.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Configuración de Multer.
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 10 // Límite de 10 MB por archivo
    },
    fileFilter: (req, file, cb) => {
        // Aceptar solo ciertos tipos de archivos (opcional pero recomendado)
        const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: Tipo de archivo no soportado.'));
    }
});

// Se exporta la instancia de Multer directamente.
// Esto permite usar upload.array(), upload.single(), etc. en las rutas.
module.exports = upload;
