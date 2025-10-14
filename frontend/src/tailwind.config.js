// tailwind.config.js
module.exports = {
  // Habilita el modo oscuro basado en la clase 'dark' en el elemento <html>
  darkMode: 'class', 
  // Configura los archivos donde Tailwind debe buscar clases para purgar CSS no utilizado
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Extiende el tema predeterminado de Tailwind con tus colores y otras propiedades
  theme: {
    extend: {
      colors: {
        // Colores de la aplicación, adaptados para modo claro y oscuro
        primary: {
          light: '#be0000', // Rojo oscuro principal para modo claro
          dark: '#B22222',  // Rojo más claro para modo oscuro
        },
        secondary: {
          light: '#6c757d', // Gris secundario para modo claro
          dark: '#a0aec0',  // Gris más claro para modo oscuro
        },
        background: {
          light: '#f0f2f5', // Fondo general para modo claro (similar a gray-100)
          dark: '#1a202c',  // Fondo general para modo oscuro (similar a gray-900)
        },
        text: {
          DEFAULT: '#333',  // Color de texto principal para modo claro
          dark: '#e2e8f0',  // Color de texto principal para modo oscuro
          light: '#666',    // Color de texto secundario para modo claro
          darker: '#eee',   // Color de texto más claro para modo oscuro
        },
        card: {
          DEFAULT: '#ffffff', // Fondo de tarjetas para modo claro
          dark: '#2d3748',    // Fondo de tarjetas para modo oscuro (similar a gray-800)
        },
        border: {
          DEFAULT: '#e0e0e0', // Color de borde para modo claro
          dark: '#4a5568',    // Color de borde para modo oscuro (similar a gray-700)
        },
        input: {
          DEFAULT: '#ffffff', // Fondo de inputs para modo claro
          dark: '#2d3748',    // Fondo de inputs para modo oscuro
        },
        // Colores específicos para mensajes de estado y botones
        success: {
          light: '#28a745', // Verde para éxito
          dark: '#48bb78',
        },
        error: {
          light: '#dc3545', // Rojo para error
          dark: '#f56565',
        },
        info: {
          light: '#0483ff', // Azul para información
          dark: '#4299e1',
        },
        warning: {
          light: '#ffc107', // Amarillo para advertencia
          dark: '#f6e05e',
        },
        // Colores para gráficos (se pueden mapear a la paleta de Tailwind o mantener personalizados)
        chart: {
          'color-1': { light: '#be0000', dark: '#B22222' },
          'color-2': { light: '#ed8936', dark: '#f6ad55' },
          'color-3': { light: '#48bb78', dark: '#68d391' },
          'color-4': { light: '#a0aec0', dark: '#cbd5e0' },
          'color-5': { light: '#e53e3e', dark: '#fc8181' },
          'color-6': { light: '#ecc94b', dark: '#fbd38d' },
          'color-7': { light: '#805ad5', dark: '#b794f4' },
          'color-8': { light: '#ff7300', dark: '#f6ad55' },
          'color-9': { light: '#8884d8', dark: '#a78bfa' },
          'text': { light: '#333', dark: '#e2e8f0' }, // Color de texto para gráficos
        },
      },
      // Extiende las configuraciones de sombras si tus sombras personalizadas difieren de las de Tailwind
      boxShadow: {
        'md-custom': '0 4px 6px rgba(0, 0, 0, 0.1)', // Sombra para modo claro
        'md-dark': '0 4px 6px rgba(0, 0, 0, 0.3)',   // Sombra para modo oscuro
      }
    },
  },
  plugins: [], // Asegúrate de incluir cualquier plugin que uses
}
