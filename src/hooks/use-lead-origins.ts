import { useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';

export const useLeadOrigins = () => {
  const { leads } = useCRM();

  const origins = useMemo(() => {
    // Obter origens únicas dos leads do usuário logado
    const uniqueOrigins = [...new Set(leads.map(l => l.source))].filter(origem => origem && origem.trim() !== '');
    
    // Ordenar alfabeticamente
    return uniqueOrigins.sort();
  }, [leads]);

  const getOriginCount = (origin: string) => {
    return leads.filter(l => l.source === origin).length;
  };

  const getTopOrigins = (limit: number = 5) => {
    const originCounts = origins.map(origin => ({
      name: origin,
      count: getOriginCount(origin)
    }));

    // Ordenar por quantidade (maior para menor)
    originCounts.sort((a, b) => b.count - a.count);
    
    return originCounts.slice(0, limit);
  };

  return {
    origins,
    getOriginCount,
    getTopOrigins
  };
}; 