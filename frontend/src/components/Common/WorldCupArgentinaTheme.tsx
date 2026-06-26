import React from 'react';
import { isWorldCupThemeActive, WORLD_CUP_LABEL } from '../../config/worldCupTheme';
import './WorldCupArgentinaTheme.css';

const CONFETTI_COUNT = 12;

/** Decoración sobre el panel de video del login. */
export const WorldCupLoginOverlay: React.FC = () => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-login-overlay" aria-hidden>
            <div className="wc-login-gradient" />
            <div className="wc-login-stripes" />
            {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
                <span key={i} className="wc-confetti" />
            ))}
            <span className="wc-ball" role="presentation">
                ⚽
            </span>
            <div className="wc-login-banner">
                <div className="wc-sun" />
                <p className="wc-login-banner-text">
                    <strong>Vamos Argentina</strong>
                    <br />
                    {WORLD_CUP_LABEL} · Dale que vamos 🇦🇷
                </p>
            </div>
        </div>
    );
};

interface WorldCupDashboardBannerProps {
    /** Ej: "Dashboard de Administrador" */
    pageTitle: string;
    /** Nombre del usuario logueado */
    userName?: string | null;
}

/** Banner animado en la home de cada rol. */
export const WorldCupDashboardBanner: React.FC<WorldCupDashboardBannerProps> = ({ pageTitle, userName }) => {
    if (!isWorldCupThemeActive()) return null;

    const greeting = userName ? `¡Hola, ${userName}!` : '¡Bienvenido!';

    return (
        <div className="wc-argentina-root wc-dashboard-banner" role="status" aria-live="polite">
            <div className="wc-dashboard-inner">
                <span className="wc-dashboard-flag" aria-hidden>
                    🇦🇷
                </span>
                <div className="wc-dashboard-copy">
                    <p className="wc-dashboard-title">
                        {greeting} · <em>Vamos Argentina</em>
                    </p>
                    <p className="wc-dashboard-subtitle">
                        {pageTitle} — {WORLD_CUP_LABEL}. ¡Alentemos juntos desde Bacar OS!
                    </p>
                </div>
                <div className="wc-dashboard-sparkles" aria-hidden>
                    <span className="wc-sparkle" />
                    <span className="wc-sparkle" />
                    <span className="wc-sparkle" />
                </div>
            </div>
        </div>
    );
};
