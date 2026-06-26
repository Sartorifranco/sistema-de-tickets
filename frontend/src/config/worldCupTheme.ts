/** Tema visual Argentina · Mundial 2026 (activable por fechas o variable de entorno). */

const THEME_START = new Date('2026-05-01T00:00:00');
const THEME_END = new Date('2026-07-20T23:59:59');

function envOverride(): boolean | null {
    const raw = process.env.REACT_APP_WORLD_CUP_THEME?.trim().toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'on') return true;
    if (raw === 'false' || raw === '0' || raw === 'off') return false;
    return null;
}

export function isWorldCupThemeActive(): boolean {
    const override = envOverride();
    if (override !== null) return override;
    const now = new Date();
    return now >= THEME_START && now <= THEME_END;
}

export const WORLD_CUP_LABEL = 'Mundial 2026';
