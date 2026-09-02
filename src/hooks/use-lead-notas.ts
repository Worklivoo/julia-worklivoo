import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';

export interface LeadNota {
  anotacao_id: string;
  anotacao_conteudo: string;
  lead_id: number;
  user_id: string;
  anotacao_fixada: boolean;
  criado_em: string;
  atualizado_em: string;
  membro_id: string | null;
  membro_nome: string | null;
}

export interface LeadNotaInput {
  anotacao_conteudo: string;
  anotacao_fixada?: boolean;
}

const parseTimestamp = (value: unknown): Date => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return new Date(0);
  const normalized = raw
    .replace(' ', 'T')
    .replace(/\+00:00$/, 'Z')
    .replace(/\+00$/, 'Z')
    .replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
};

const sortNotas = (rows: LeadNota[]): LeadNota[] =>
  [...rows].sort((a, b) => {
    if (a.anotacao_fixada !== b.anotacao_fixada) return a.anotacao_fixada ? -1 : 1;
    const ta = parseTimestamp(a.criado_em).getTime();
    const tb = parseTimestamp(b.criado_em).getTime();
    return tb - ta;
  });

export function useLeadNotas({ leadId, user }: { leadId: string | undefined; user: User | null }) {
  const [notas, setNotas] = useState<LeadNota[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { toast } = useToast();

  const userIdEmpresa = user ? (user.isMembro ? user.user_id_empresa : user.id) : null;
  const membroIdAtual = user?.isMembro ? user.membroId ?? null : null;

  const fetchNotas = useCallback(async () => {
    if (!leadId || !userIdEmpresa) {
      setNotas([]);
      return;
    }
    const leadIdNumber = Number(leadId);
    if (!Number.isFinite(leadIdNumber)) {
      setNotas([]);
      return;
    }

    setLoading(true);
    try {
      const { data: notasData, error: notasError } = await supabase
        .from('leads_notas_v2')
        .select('*')
        .eq('lead_id', leadIdNumber)
        .eq('user_id', userIdEmpresa);

      if (notasError) throw notasError;

      const membroIds = Array.from(
        new Set((notasData ?? []).map((r: any) => r.membro_id).filter(Boolean))
      ) as string[];

      let membrosMap: Record<string, string> = {};
      if (membroIds.length > 0) {
        const { data: membrosData, error: membrosError } = await supabase
          .from('membros_v2')
          .select('membro_id, membro_nome')
          .in('membro_id', membroIds);
        if (!membrosError && membrosData) {
          membrosMap = (membrosData as any[]).reduce((acc, m) => {
            acc[m.membro_id] = m.membro_nome;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const rows: LeadNota[] = (notasData ?? []).map((r: any) => ({
        anotacao_id: String(r.anotacao_id),
        anotacao_conteudo: String(r.anotacao_conteudo ?? ''),
        lead_id: Number(r.lead_id),
        user_id: String(r.user_id),
        anotacao_fixada: Boolean(r.anotacao_fixada),
        criado_em: String(r.criado_em ?? ''),
        atualizado_em: String(r.atualizado_em ?? ''),
        membro_id: r.membro_id ? String(r.membro_id) : null,
        membro_nome: r.membro_id ? (membrosMap[String(r.membro_id)] ?? null) : (user?.nome ?? null),
      }));

      setNotas(sortNotas(rows));
    } catch (error: any) {
      console.error('[useLeadNotas] Erro ao buscar anotações:', error);
      toast({
        title: 'Erro ao carregar anotações',
        description: error?.message || 'Não foi possível carregar as anotações do lead.',
      });
      setNotas([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, userIdEmpresa, user?.nome, toast]);

  useEffect(() => {
    fetchNotas();
  }, [fetchNotas]);

  const actionStart = (id: string) => setLoadingAction(id);
  const actionEnd = () => setLoadingAction(null);

  const createNota = useCallback(
    async (payload: LeadNotaInput): Promise<boolean> => {
      if (!leadId || !userIdEmpresa) return false;
      const leadIdNumber = Number(leadId);
      if (!Number.isFinite(leadIdNumber)) return false;

      const id = `create-${Date.now()}`;
      actionStart(id);
      try {
        const now = new Date().toISOString();
        const insert: Record<string, unknown> = {
          lead_id: leadIdNumber,
          user_id: userIdEmpresa,
          membro_id: membroIdAtual,
          anotacao_conteudo: String(payload.anotacao_conteudo ?? '').trim(),
          anotacao_fixada: Boolean(payload.anotacao_fixada ?? false),
          criado_em: now,
          atualizado_em: now,
        };

        const { data, error } = await supabase
          .from('leads_notas_v2')
          .insert(insert)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Nenhuma linha retornada após inserção.');

        const row = data as any;
        const nova: LeadNota = {
          anotacao_id: String(row.anotacao_id),
          anotacao_conteudo: String(row.anotacao_conteudo ?? ''),
          lead_id: Number(row.lead_id),
          user_id: String(row.user_id),
          anotacao_fixada: Boolean(row.anotacao_fixada),
          criado_em: String(row.criado_em ?? ''),
          atualizado_em: String(row.atualizado_em ?? ''),
          membro_id: row.membro_id ? String(row.membro_id) : null,
          membro_nome: row.membro_id ? (row.membro_nome ?? user?.nome ?? null) : (user?.nome ?? null),
        };

        setNotas((prev) => sortNotas([nova, ...prev]));
        toast({
          title: 'Anotação criada',
          description: 'A anotação foi salva com sucesso.',
        });
        return true;
      } catch (error: any) {
        console.error('[useLeadNotas] createNota error:', error);
        toast({
          title: 'Erro ao salvar anotação',
          description: error?.message || 'Não foi possível salvar a anotação.',
        });
        return false;
      } finally {
        actionEnd();
      }
    },
    [leadId, userIdEmpresa, membroIdAtual, user?.nome, toast]
  );

  const updateNota = useCallback(
    async (anotacaoId: string, updates: Partial<Pick<LeadNotaInput, 'anotacao_conteudo' | 'anotacao_fixada'>>): Promise<boolean> => {
      if (!anotacaoId) return false;

      const id = `update-${anotacaoId}`;
      actionStart(id);
      try {
        const payload: Record<string, unknown> = {
          atualizado_em: new Date().toISOString(),
        };
        if (Object.prototype.hasOwnProperty.call(updates, 'anotacao_conteudo')) {
          payload.anotacao_conteudo = String(updates.anotacao_conteudo ?? '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'anotacao_fixada')) {
          payload.anotacao_fixada = Boolean(updates.anotacao_fixada);
        }

        const { data, error } = await supabase
          .from('leads_notas_v2')
          .update(payload)
          .eq('anotacao_id', anotacaoId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Nenhuma linha retornada após atualização.');

        const row = data as any;
        setNotas((prev) =>
          sortNotas(
            prev.map((n) =>
              n.anotacao_id === anotacaoId
                ? {
                    ...n,
                    anotacao_conteudo: String(row.anotacao_conteudo ?? n.anotacao_conteudo),
                    anotacao_fixada: Boolean(row.anotacao_fixada ?? n.anotacao_fixada),
                    atualizado_em: String(row.atualizado_em ?? n.atualizado_em),
                  }
                : n
            )
          )
        );
        return true;
      } catch (error: any) {
        console.error('[useLeadNotas] updateNota error:', error);
        toast({
          title: 'Erro ao atualizar anotação',
          description: error?.message || 'Não foi possível atualizar a anotação.',
        });
        return false;
      } finally {
        actionEnd();
      }
    },
    [toast]
  );

  const toggleFixada = useCallback(
    async (anotacaoId: string, currentFixada: boolean): Promise<boolean> => {
      return updateNota(anotacaoId, { anotacao_fixada: !currentFixada });
    },
    [updateNota]
  );

  const deleteNota = useCallback(
    async (anotacaoId: string): Promise<boolean> => {
      if (!anotacaoId) return false;

      const id = `delete-${anotacaoId}`;
      actionStart(id);
      try {
        const { error } = await supabase
          .from('leads_notas_v2')
          .delete()
          .eq('anotacao_id', anotacaoId);

        if (error) throw error;

        setNotas((prev) => prev.filter((n) => n.anotacao_id !== anotacaoId));
        toast({
          title: 'Anotação excluída',
          description: 'A anotação foi removida com sucesso.',
        });
        return true;
      } catch (error: any) {
        console.error('[useLeadNotas] deleteNota error:', error);
        toast({
          title: 'Erro ao excluir anotação',
          description: error?.message || 'Não foi possível excluir a anotação.',
        });
        return false;
      } finally {
        actionEnd();
      }
    },
    [toast]
  );

  const isMine = (nota: LeadNota): boolean => {
    if (!user) return false;
    if (!nota.membro_id) return !user.isMembro;
    if (!user.isMembro) return false;
    return String(nota.membro_id) === String(user.membroId ?? '');
  };

  return {
    notas,
    loading,
    loadingAction,
    createNota,
    updateNota,
    toggleFixada,
    deleteNota,
    fetchNotas,
    isMine,
    isAdmin: user?.isMembro ? user.membro_tipo === 'Administrador' : true,
    membroNomeAtual: user?.nome ?? null,
  };
}
