const { predictCategory, predictPriority } = require('../services/aiService');

// @desc    Analizar texto y predecir categoría/prioridad
// @route   POST /api/ai/predict
const predictTicket = (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Falta el texto a analizar' });
    }

    const category = predictCategory(text);
    const priority = predictPriority(text);

    res.json({
        success: true,
        data: {
            suggestedCategory: category,
            suggestedPriority: priority
        }
    });
};

module.exports = { predictTicket };