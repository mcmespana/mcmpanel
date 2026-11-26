import { useCallback, useEffect, useState } from 'react';

// Favoritos de comentarios, SOLO en este navegador (localStorage). Sirven para
// montar un resumen personalizado: en el panel alimentan «Lo más destacado» del
// informe; en la página pública, el «Mi resumen» de quien la está leyendo.
// Nunca se suben a Firebase por sí solos. Si el almacenamiento está bloqueado
// (modo privado), todo funciona igual pero no se recuerda al recargar.

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* almacenamiento no disponible: se queda en memoria */
  }
}

/** Lista ordenada (por orden de marcado) de ids favoritos bajo `key`. */
export function useFavorites(key: string) {
  const [ids, setIds] = useState<string[]>(() => read(key));

  useEffect(() => {
    setIds(read(key));
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setIds(read(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    write(key, []);
    setIds([]);
  }, [key]);

  return { ids, has: (id: string) => ids.includes(id), toggle, clear };
}

export const panelFavoritesKey = (surveyKey: string) => `mcm-panel:favs:${surveyKey}`;
export const publicFavoritesKey = (slug: string) => `mcm-informe:favs:${slug}`;
