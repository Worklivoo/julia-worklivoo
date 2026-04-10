import { useState, useEffect } from 'react';

/**
 * Hook personalizado para gerenciar estado persistente usando localStorage
 * @param key - Chave única para armazenar no localStorage
 * @param defaultValue - Valor padrão caso não exista no localStorage
 * @returns [state, setState] - Array com o estado atual e função para atualizá-lo
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prevState: T) => T)) => void] {
  // Inicializar estado com valor do localStorage ou valor padrão
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Erro ao recuperar estado persistente para chave "${key}":`, error);
      return defaultValue;
    }
  });

  // Função para atualizar o estado e salvar no localStorage
  const setPersistentState = (value: T | ((prevState: T) => T)) => {
    try {
      const newValue = typeof value === 'function' ? (value as (prevState: T) => T)(state) : value;
      setState(newValue);
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.error(`Erro ao salvar estado persistente para chave "${key}":`, error);
    }
  };

  // Sincronizar com mudanças no localStorage de outras abas/janelas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setState(newValue);
        } catch (error) {
          console.warn(`Erro ao sincronizar estado persistente para chave "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [state, setPersistentState];
}

/**
 * Hook especializado para persistir estado de abas/seções
 * @param pageKey - Identificador único da página (ex: 'auth', 'settings', 'dashboard')
 * @param defaultTab - Aba padrão
 * @returns [activeTab, setActiveTab] - Estado da aba ativa e função para alterá-la
 */
export function usePersistentTab(pageKey: string, defaultTab: string) {
  return usePersistentState(`${pageKey}-active-tab`, defaultTab);
}

/**
 * Hook especializado para persistir estado de seções expandidas/colapsadas
 * @param pageKey - Identificador único da página
 * @param defaultSections - Objeto com seções e seus estados padrão
 * @returns [sections, setSections] - Estado das seções e função para alterá-las
 */
export function usePersistentSections<T extends Record<string, boolean>>(
  pageKey: string,
  defaultSections: T
) {
  return usePersistentState(`${pageKey}-sections`, defaultSections);
}

/**
 * Hook especializado para persistir DateRange com conversão adequada de datas
 * @param key - Chave única para armazenar no localStorage
 * @param defaultValue - Valor padrão do DateRange
 * @returns [dateRange, setDateRange] - Array com o estado atual e função para atualizá-lo
 */
export function usePersistentDateRange(
  key: string,
  defaultValue: { from?: Date; to?: Date }
): [{ from?: Date; to?: Date }, (value: { from?: Date; to?: Date } | ((prevState: { from?: Date; to?: Date }) => { from?: Date; to?: Date })) => void] {
  // Inicializar estado com valor do localStorage ou valor padrão
  const [state, setState] = useState<{ from?: Date; to?: Date }>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (!parsed || typeof parsed !== 'object') {
          return defaultValue;
        }
        // Converter strings de volta para objetos Date
        return {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined
        };
      }
      return defaultValue;
    } catch (error) {
      console.warn(`Erro ao recuperar DateRange persistente para chave "${key}":`, error);
      return defaultValue;
    }
  });

  // Função para atualizar o estado e salvar no localStorage
  const setPersistentDateRange = (value: { from?: Date; to?: Date } | ((prevState: { from?: Date; to?: Date }) => { from?: Date; to?: Date })) => {
    try {
      const nextValue = typeof value === 'function' ? value(state) : value;
      const newValue =
        nextValue && typeof nextValue === 'object'
          ? nextValue
          : { from: undefined, to: undefined };
      setState(newValue);
      // Serializar datas como ISO strings
      const serializable = {
        from: newValue.from ? newValue.from.toISOString() : undefined,
        to: newValue.to ? newValue.to.toISOString() : undefined
      };
      localStorage.setItem(key, JSON.stringify(serializable));
    } catch (error) {
      console.error(`Erro ao salvar DateRange persistente para chave "${key}":`, error);
    }
  };

  // Sincronizar com mudanças no localStorage de outras abas/janelas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (!parsed || typeof parsed !== 'object') {
            setState(defaultValue);
            return;
          }
          const newValue = {
            from: parsed.from ? new Date(parsed.from) : undefined,
            to: parsed.to ? new Date(parsed.to) : undefined
          };
          setState(newValue);
        } catch (error) {
          console.warn(`Erro ao sincronizar DateRange persistente para chave "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [state, setPersistentDateRange];
}

export default usePersistentState;
