import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from 'react';
import api from '../config/axiosConfig';
import { useAuth } from './AuthContext';
import {
    SystemModuleKey,
    SYSTEM_MODULES,
    SystemModuleDef,
    defaultEnabledMap,
} from '../constants/systemModules';

interface SystemModulesContextType {
    loading: boolean;
    modules: (SystemModuleDef & { enabled: boolean })[];
    enabledMap: Record<SystemModuleKey, boolean>;
    isModuleEnabled: (key: SystemModuleKey) => boolean;
    refreshModules: () => Promise<void>;
    saveModules: (modules: Partial<Record<SystemModuleKey, boolean>>) => Promise<boolean>;
}

const SystemModulesContext = createContext<SystemModulesContextType | undefined>(undefined);

export const SystemModulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);
    const [enabledMap, setEnabledMap] = useState<Record<SystemModuleKey, boolean>>(defaultEnabledMap);

    const applyPayload = useCallback((data: { enabledMap?: Record<string, boolean> }) => {
        const next = defaultEnabledMap();
        if (data?.enabledMap) {
            (Object.keys(next) as SystemModuleKey[]).forEach((key) => {
                if (typeof data.enabledMap![key] === 'boolean') {
                    next[key] = data.enabledMap![key];
                }
            });
        }
        setEnabledMap(next);
    }, []);

    const refreshModules = useCallback(async () => {
        if (!isAuthenticated) {
            setEnabledMap(defaultEnabledMap());
            return;
        }
        setLoading(true);
        try {
            const res = await api.get('/api/system-modules');
            applyPayload(res.data.data || {});
        } catch {
            setEnabledMap(defaultEnabledMap());
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, applyPayload]);

    useEffect(() => {
        refreshModules();
    }, [refreshModules]);

    const saveModules = useCallback(
        async (modules: Partial<Record<SystemModuleKey, boolean>>) => {
            const res = await api.put('/api/system-modules', { modules });
            applyPayload(res.data.data || {});
            return true;
        },
        [applyPayload]
    );

    const isModuleEnabled = useCallback(
        (key: SystemModuleKey) => enabledMap[key] !== false,
        [enabledMap]
    );

    const modules = useMemo(
        () =>
            SYSTEM_MODULES.map((m) => ({
                ...m,
                enabled: enabledMap[m.key] !== false,
            })),
        [enabledMap]
    );

    const value = useMemo(
        () => ({
            loading,
            modules,
            enabledMap,
            isModuleEnabled,
            refreshModules,
            saveModules,
        }),
        [loading, modules, enabledMap, isModuleEnabled, refreshModules, saveModules]
    );

    return (
        <SystemModulesContext.Provider value={value}>{children}</SystemModulesContext.Provider>
    );
};

export function useSystemModules(): SystemModulesContextType {
    const ctx = useContext(SystemModulesContext);
    if (!ctx) {
        throw new Error('useSystemModules debe usarse dentro de SystemModulesProvider');
    }
    return ctx;
}

/** Seguro fuera del provider: asume todo habilitado. Sin key → true. */
export function useModuleEnabled(key?: SystemModuleKey): boolean {
    const ctx = useContext(SystemModulesContext);
    if (!key || !ctx) return true;
    return ctx.isModuleEnabled(key);
}
