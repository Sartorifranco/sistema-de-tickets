import { useEffect, useState } from 'react';

/** Devuelve el valor con un retardo; útil para no disparar una consulta por cada tecla. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
    const [debounced, setDebounced] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}
