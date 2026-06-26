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
            <div className="wc-login-hero-flag" aria-hidden>
                <div className="wc-arg-flag-animated">
                    <span className="wc-arg-flag-sol" />
                </div>
            </div>
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

/** Tres estrellas de campeón del mundo (78 · 86 · 22). */
export const WorldCupChampionStars: React.FC<{ size?: 'sm' | 'md' | 'lg'; showYears?: boolean }> = ({
    size = 'md',
    showYears = true,
}) => (
    <div className={`wc-champion-stars wc-champion-stars--${size}`} aria-label="Tres Copas del Mundo: 1978, 1986, 2022">
        {(['78', '86', '22'] as const).map((year, i) => (
            <span key={year} className={`wc-champion-star wc-champion-star--${i + 1}`}>
                ★
                {showYears && <small>{year}</small>}
            </span>
        ))}
    </div>
);

/** Confetti sutil para páginas internas (no bloquea clics). */
export const WorldCupAppConfetti: React.FC = () => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-app-confetti" aria-hidden>
            {Array.from({ length: 20 }, (_, i) => (
                <span key={i} className={`wc-app-confetti-piece wc-app-confetti-piece--${(i % 5) + 1}`} />
            ))}
        </div>
    );
};

/** Banderas flotantes en esquinas del área principal. */
export const WorldCupAppCornerFlags: React.FC = () => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-app-corners" aria-hidden>
            <span className="wc-app-corner-flag wc-app-corner-flag--tl">🇦🇷</span>
            <span className="wc-app-corner-flag wc-app-corner-flag--tr">🇦🇷</span>
            <span className="wc-app-corner-ball">⚽</span>
            <span className="wc-app-corner-trophy">🏆</span>
        </div>
    );
};

/** Badge festivo en sidebar (bandera + estrellas). */
export const WorldCupSidebarFestive: React.FC = () => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-sidebar-festive">
            <div className="wc-sidebar-festive-strip" />
            <div className="wc-sidebar-festive-badge">
                <span className="wc-sidebar-flag">🇦🇷</span>
                <WorldCupChampionStars size="sm" />
            </div>
            <p className="wc-sidebar-festive-text">¡Vamos Argentina!</p>
        </div>
    );
};

/** Cinta festiva en el header superior. */
export const WorldCupHeaderRibbon: React.FC<{ userName?: string | null }> = ({ userName }) => {
    if (!isWorldCupThemeActive()) return null;

    return (
        <div className="wc-argentina-root wc-header-ribbon">
            <span className="wc-header-ribbon-flag">🇦🇷</span>
            <span className="wc-header-ribbon-text">
                {userName ? `${userName}, ` : ''}
                <strong>dale que vamos</strong> · {WORLD_CUP_LABEL}
            </span>
            <WorldCupChampionStars size="sm" showYears={false} />
            <span className="wc-header-ribbon-flag">🇦🇷</span>
        </div>
    );
};

/** Banner festivo en dashboards y home de cada rol. */
export const WorldCupDashboardBanner: React.FC<WorldCupDashboardBannerProps> = ({ pageTitle, userName }) => {
    if (!isWorldCupThemeActive()) return null;

    const greeting = userName ? `¡Hola, ${userName}!` : '¡Bienvenido!';

    return (
        <div className="wc-argentina-root wc-dashboard-banner wc-dashboard-banner--festive" role="status" aria-live="polite">
            <div className="wc-dashboard-banner-confetti" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} className={`wc-dashboard-confetti wc-dashboard-confetti--${(i % 4) + 1}`} />
                ))}
            </div>
            <div className="wc-dashboard-inner">
                <div className="wc-dashboard-flags-col" aria-hidden>
                    <span className="wc-dashboard-flag wc-dashboard-flag--big">🇦🇷</span>
                    <span className="wc-dashboard-flag wc-dashboard-flag--small">🇦🇷</span>
                </div>
                <div className="wc-dashboard-copy">
                    <p className="wc-dashboard-title wc-dashboard-title--chant">
                        {greeting} · <em>¡Vamos Argentina!</em>
                    </p>
                    <WorldCupChampionStars size="md" />
                    <p className="wc-dashboard-subtitle">
                        {pageTitle} — {WORLD_CUP_LABEL} · 3 ⭐ campeones del mundo
                    </p>
                </div>
                <div className="wc-dashboard-emblems" aria-hidden>
                    <span className="wc-dashboard-emblem">⚽</span>
                    <span className="wc-dashboard-emblem wc-dashboard-emblem--trophy">🏆</span>
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
