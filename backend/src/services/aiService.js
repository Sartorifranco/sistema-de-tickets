const natural = require('natural');
const classifier = new natural.BayesClassifier();

/** Coincidencias para sugerir el área (departamento) "Desarrollo" — ver predictDepartment */
const DESARROLLO_KEYWORDS = [
    'bug',
    'error de código',
    'nueva funcionalidad',
    'desarrollo',
    'servidores',
    'base de datos',
    'api',
    'reunión de planificación',
    'deploy',
    'error de codigo',
    'reunion de planificacion',
];

function normalizeForKeywordMatch(s) {
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
}

// --- FASE 1: ENTRENAMIENTO BÁSICO ---
// En el futuro, esto podría leerse de tu base de datos de tickets históricos.
// Por ahora, le enseñamos manualmente.

const trainAI = () => {
    console.log("🧠 Entrenando IA...");

    // CATEGORÍA: HARDWARE
    classifier.addDocument('La impresora no prende', 'Hardware');
    classifier.addDocument('El monitor esta negro', 'Hardware');
    classifier.addDocument('Se rompio el teclado', 'Hardware');
    classifier.addDocument('Humo saliendo del cpu', 'Hardware');
    classifier.addDocument('disco duro lleno', 'Hardware');
    classifier.addDocument('mouse no funciona', 'Hardware');

    // CATEGORÍA: SOFTWARE / SISTEMA
    classifier.addDocument('No puedo entrar al sistema', 'Software');
    classifier.addDocument('Olvide mi clave contraseña', 'Software');
    classifier.addDocument('Error al guardar archivo', 'Software');
    classifier.addDocument('El programa se cierra solo', 'Software');
    classifier.addDocument('Windows esta lento', 'Software');
    classifier.addDocument('Pantalla azul', 'Software');

    // CATEGORÍA: CONECTIVIDAD
    classifier.addDocument('No hay internet', 'Conectividad');
    classifier.addDocument('El wifi no conecta', 'Conectividad');
    classifier.addDocument('No puedo acceder a la red', 'Conectividad');
    classifier.addDocument('VPN desconectada', 'Conectividad');
    classifier.addDocument('Red lenta', 'Conectividad');

    // CATEGORÍA: PEAJES (Específico de tu negocio)
    classifier.addDocument('Barrera no levanta', 'Peaje');
    classifier.addDocument('Sensor de via fallando', 'Peaje');
    classifier.addDocument('Semáforo apagado', 'Peaje');
    classifier.addDocument('Cabina sin luz', 'Peaje');

    classifier.train();
    console.log("🧠 IA Entrenada y lista.");
    console.log(
        "   Área Desarrollo (sugerencia por texto): palabras clave en predictDepartment →",
        DESARROLLO_KEYWORDS.slice(0, 9).join(', '),
        '…'
    );
};

// Entrenamos apenas inicia el servicio
trainAI();

// Función para predecir
const predictCategory = (text) => {
    if (!text) return null;
    return classifier.classify(text);
};

/**
 * Sugiere el nombre de área/departamento "Desarrollo" si el texto contiene las palabras clave acordadas.
 */
const predictDepartment = (text) => {
    if (!text) return null;
    const normalized = normalizeForKeywordMatch(text);
    const hit = DESARROLLO_KEYWORDS.some((kw) =>
        normalized.includes(normalizeForKeywordMatch(kw))
    );
    return hit ? 'Desarrollo' : null;
};

// Función simple para detectar urgencia (basada en palabras clave)
const predictPriority = (text) => {
    const textLower = text.toLowerCase();
    const criticalWords = ['fuego', 'humo', 'caído', 'urgente', 'parada total', 'robo', 'inseguridad', 'muerto'];
    const highWords = ['error crítico', 'no funciona', 'fallo', 'roto', 'barrera'];
    
    if (criticalWords.some(word => textLower.includes(word))) return 'Crítica';
    if (highWords.some(word => textLower.includes(word))) return 'Alta';
    return 'Media'; // Por defecto
};

module.exports = {
    predictCategory,
    predictPriority,
    predictDepartment,
};