import React from 'react';
import { isWorldCupThemeActive, WORLD_CUP_LABEL } from '../../config/worldCupTheme';
import './WorldCupArgentinaTheme.css';

const CONFETTI_COUNT = 28;
const FLOATING_FLAGS = 6;

/** Decoración festiva exclusiva del panel del formulario (lado derecho del login). */
export const WorldCupLoginPanelFestive: React.FC = () => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-login-panel-festive" aria-hidden>
            <div className="wc-panel-bg-shimmer" />
            <div className="wc-panel-bg-stripes" />
            <div className="wc-panel-glow wc-panel-glow--1" />
            <div className="wc-panel-glow wc-panel-glow--2" />
            <div className="wc-panel-glow wc-panel-glow--3" />

            {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
                <span key={`c-${i}`} className={`wc-panel-confetti wc-panel-confetti--${(i % 7) + 1}`} />
            ))}

            {Array.from({ length: FLOATING_FLAGS }, (_, i) => (
                <span key={`f-${i}`} className={`wc-panel-flag wc-panel-flag--${i + 1}`}>
                    🇦🇷
                </span>
            ))}

            <span className="wc-panel-ball wc-panel-ball--1">⚽</span>
            <span className="wc-panel-ball wc-panel-ball--2">⚽</span>
            <span className="wc-panel-ball wc-panel-ball--3">🏆</span>

            <div className="wc-panel-stars">
                {Array.from({ length: 8 }, (_, i) => (
                    <span key={`s-${i}`} className={`wc-panel-star wc-panel-star--${i + 1}`}>
                        ★
                    </span>
                ))}
            </div>
        </div>
    );
};

/** Cabecera mundialista sobre el logo del login. */
export const WorldCupLoginHero: React.FC = () => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-login-hero">
            <div className="wc-login-hero-sun" />
            <p className="wc-login-hero-chant wc-login-hero-chant--1">¡VAMOS ARGENTINA!</p>
            <p className="wc-login-hero-chant wc-login-hero-chant--2">🇦🇷 {WORLD_CUP_LABEL} · DALE QUE VAMOS 🇦🇷</p>
            <p className="wc-login-hero-sub">Con la misma pasión, entrá a Bacar OS</p>
        </div>
    );
};

interface WorldCupDashboardBannerProps {
    pageTitle: string;
    userName?: string | null;
}

/** Banner estático en dashboards (sin animaciones pesadas). */
export const WorldCupDashboardBanner: React.FC<WorldCupDashboardBannerProps> = ({ pageTitle, userName }) => {
    if (!isWorldCupThemeActive()) return null;

    const greeting = userName ? `¡Hola, ${userName}!` : '¡Bienvenido!';

    return (
        <div className="wc-argentina-root wc-dashboard-banner" role="status">
            <div className="wc-dashboard-inner">
                <span className="wc-dashboard-flag" aria-hidden>
                    🇦🇷
                </span>
                <div className="wc-dashboard-copy">
                    <p className="wc-dashboard-title">
                        {greeting} · <em>Vamos Argentina</em>
                    </p>
                    <p className="wc-dashboard-subtitle">
                        {pageTitle} — {WORLD_CUP_LABEL}
                    </p>
                </div>
            </div>
        </div>
    );
};

/** Clases condicionales para el panel lateral del login. */
export function getWorldCupLoginPanelClass(): string {
    return isWorldCupThemeActive() ? 'wc-login-panel' : '';
}

export function getWorldCupSubmitButtonClass(loading: boolean): string {
    const base =
        'flex w-full justify-center rounded-xl px-4 py-3.5 text-sm !font-bold uppercase tracking-wider shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-400 disabled:hover:bg-gray-400 disabled:shadow-none';

    if (!isWorldCupThemeActive()) {
        return `${base} bg-[#DC2626] text-white hover:bg-[#B91C1C] focus:ring-[#DC2626]`;
    }

    return `${base} wc-btn-argentina text-white`;
}

export function getWorldCupRegisterLinkClass(): string {
    if (!isWorldCupThemeActive()) {
        return 'font-medium text-[#DC2626] underline-offset-2 hover:text-[#B91C1C] hover:underline';
    }
    return 'font-bold text-[#2B6CB0] underline-offset-2 hover:text-[#1A4F8A] hover:underline wc-link-celeste';
}
