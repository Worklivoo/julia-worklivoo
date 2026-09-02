import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';

export interface LeadTarefa {
  tarefa_id: string;
  tarefa_titulo: string;
  tarefa_descricao: string | null;
  lead_id: number;
  user_id: string;
  membro_id: string | null;
  membro_nome: string | null;
  data_vencimento: string | null;
  tarefa_concluida: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface LeadTarefaInput {
  tarefa_titulo: string;
  tarefa_descricao?: string;
  data_vencimento?: string | null;
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

const normalizeForCompare = (value: unknown): number => parseTimestamp(value).getTime();

const sortTarefas = (rows: LeadTarefa[]): LeadTarefa[] =>
  [...rows].sort((a, b) => {
    if (a.tarefa_concluida !== b.tarefa_concluida) return a.tarefa_concluida ? 1 : -1;
    const ad = a.data_vencimento ? normalizeForCompare(a.data_vencimento) : Number.POSITIVE_INFINITY;
    const bd = b.data_vencimento ? normalizeForCompare(b.data_vencimento) : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return normalizeForCompare(b.criado_em) - normalizeForCompare(a.criado_em);
  });

export function useLeadTarefas({ leadId, user }: { leadId: string | undefined; user: User | null }) {
  const [tarefas, setTarefas] = useState<LeadTarefa[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { toast } = useToast();

  const userIdEmpresa = user ? (user.isMembro ? user.user_id_empresa : user.id) : null;
  const membroIdAtual = user?.isMembro ? user.membroId ?? null : null;

  const fetchTarefas = useCallback(async () => {
    if (!leadId || !userIdEmpresa) {
      setTarefas([]);
      return;
    }
    const leadIdNumber = Number(leadId);
    if (!Number.isFinite(leadIdNumber)) {
      setTarefas([]);
      return;
    }

    setLoading(true);
    try {
      const { data: tarefasData, error: tarefasError } = await supabase
        .from('lead_tarefas_v2')
        .select('*')
        .eq('lead_id', leadIdNumber)
        .eq('user_id', userIdEmpresa);

      if (tarefasError) throw tarefasError;

      const membroIds = Array.from(
        new Set((tarefasData ?? []).map((r: any) => r.membro_id).filter(Boolean))
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

      const rows: LeadTarefa[] = (tarefasData ?? []).map((r: any) => ({
        tarefa_id: String(r.tarefa_id),
        tarefa_titulo: String(r.tarefa_titulo ?? ''),
        tarefa_descricao: r.tarefa_descricao != null ? String(r.tarefa_descricao) : null,
        lead_id: Number(r.lead_id),
        user_id: String(r.user_id),
        membro_id: r.membro_id ? String(r.membro_id) : null,
        membro_nome: r.membro_id ? (membrosMap[String(r.membro_id)] ?? null) : (user?.nome ?? null),
        data_vencimento: r.data_vencimento ? String(r.data_vencimento) : null,
        tarefa_concluida: Boolean(r.tarefa_concluida),
        criado_em: String(r.criado_em ?? ''),
        atualizado_em: String(r.atualizado_em ?? ''),
      }));

      setTarefas(sortTarefas(rows));
    } catch (error: any) {
      console.error('[useLeadTarefas] Erro ao buscar tarefas:', error);
      toast({
        title: 'Erro ao carregar tarefas',
        description: error?.message || 'Não foi possível carregar as tarefas do lead.',
      });
      setTarefas([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, userIdEmpresa, user?.nome, toast]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  const actionStart = (id: string) => setLoadingAction(id);
  const actionEnd = () => setLoadingAction(null);

  const createTarefa = useCallback(
    async (payload: LeadTarefaInput): Promise<boolean> => {
      if (!leadId || !userIdEmpresa) return false;
      const leadIdNumber = Number(leadId);
      if (!Number.isFinite(leadIdNumber)) return false;
      if (!String(payload.tarefa_titulo ?? '').trim()) return false;

      const id = `create-${Date.now()}`;
      actionStart(id);
      try {
        const now = new Date().toISOString();
        const insert: Record<string, unknown> = {
          lead_id: leadIdNumber,
          user_id: userIdEmpresa,
          membro_id: membroIdAtual,
          tarefa_titulo: String(payload.tarefa_titulo ?? '').trim(),
          tarefa_descricao:
            payload.tarefa_descricao != null && String(payload.tarefa_descricao).trim()
              ? String(payload.tarefa_descricao).trim()
              : null,
          data_vencimento:
            payload.data_vencimento && String(payload.data_vencimento).trim()
              ? String(payload.data_vencimento).trim()
              : null,
          tarefa_concluida: false,
          criado_em: now,
          atualizado_em: now,
        };

        const { data, error } = await supabase
          .from('lead_tarefas_v2')
          .insert(insert)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Nenhuma linha retornada após inserção.');

        const row = data as any;
        const nova: LeadTarefa = {
          tarefa_id: String(row.tarefa_id),
          tarefa_titulo: String(row.tarefa_titulo ?? ''),
          tarefa_descricao: row.tarefa_descricao != null ? String(row.tarefa_descricao) : null,
          lead_id: Number(row.lead_id),
          user_id: String(row.user_id),
          membro_id: row.membro_id ? String(row.membro_id) : null,
          membro_nome: row.membro_id ? (row.membro_nome ?? user?.nome ?? null) : (user?.nome ?? null),
          data_vencimento: row.data_vencimento ? String(row.data_vencimento) : null,
          tarefa_concluida: Boolean(row.tarefa_concluida),
          criado_em: String(row.criado_em ?? ''),
          atualizado_em: String(row.atualizado_em ?? ''),
        };

        setTarefas((prev) => sortTarefas([nova, ...prev]));
        toast({
          title: 'Tarefa criada',
          description: 'A tarefa foi salva com sucesso.',
        });
        return true;
      } catch (error: any) {
        console.error('[useLeadTarefas] createTarefa error:', error);
        toast({
          title: 'Erro ao salvar tarefa',
          description: error?.message || 'Não foi possível salvar a tarefa.',
        });
        return false;
      } finally {
        actionEnd();
      }
    },
    [leadId, userIdEmpresa, membroIdAtual, user?.nome, toast]
  );

  const updateTarefa = useCallback(
    async (
      tarefaId: string,
      updates: Partial<Pick<LeadTarefaInput, 'tarefa_titulo' | 'tarefa_descricao' | 'data_vencimento'> & { tarefa_concluida?: boolean }>
    ): Promise<boolean> => {
      if (!tarefaId) return false;

      const id = `update-${tarefaId}`;
      actionStart(id);
      try {
        const payload: Record<string, unknown> = {
          atualizado_em: new Date().toISOString(),
        };
        if (Object.prototype.hasOwnProperty.call(updates, 'tarefa_titulo')) {
          const t = String(updates.tarefa_titulo ?? '').trim();
          if (!t) throw new Error('O título da tarefa é obrigatório.');
          payload.tarefa_titulo = t;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'tarefa_descricao')) {
          const d = updates.tarefa_descricao;
          payload.tarefa_descricao = d != null && String(d).trim() ? String(d).trim() : null;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'data_vencimento')) {
          const d = updates.data_vencimento;
          payload.data_vencimento = d && String(d).trim() ? String(d).trim() : null;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'tarefa_concluida')) {
          payload.tarefa_concluida = Boolean(updates.tarefa_concluida);
        }

        const { data, error } = await supabase
          .from('lead_tarefas_v2')
          .update(payload)
          .eq('tarefa_id', tarefaId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Nenhuma linha retornada após atualização.');

        const row = data as any;
        setTarefas((prev) =>
          sortTarefas(
            prev.map((t) =>
              t.tarefa_id === tarefaId
                ? {
                    ...t,
                    tarefa_titulo: String(row.tarefa_titulo ?? t.tarefa_titulo),
                    tarefa_descricao:
                      row.tarefa_descricao != null ? String(row.tarefa_descricao) : t.tarefa_descricao,
                    data_vencimento: row.data_vencimento ? String(row.data_vencimento) : t.data_vencimento,
                    tarefa_concluida: Boolean(row.tarefa_concluida ?? t.tarefa_concluida),
                    atualizado_em: String(row.atualizado_em ?? t.atualizado_em),
                  }
                : t
            )
          )
        );
        return true;
      } catch (error: any) {
        console.error('[useLeadTarefas] updateTarefa error:', error);
        toast({
          title: 'Erro ao atualizar tarefa',
          description: error?.message || 'Não foi possível atualizar a tarefa.',
        });
        return false;
      } finally {
        actionEnd();
      }
    },
    [toast]
  );

  const toggleConcluida = useCallback(
    async (tarefaId: string, current: boolean): Promise<boolean> => {
      return updateTarefa(tarefaId, { tarefa_concluida: !current });
    },
    [updateTarefa]
  );

  const deleteTarefa = useCallback(
    async (tarefaId: string): Promise<boolean> => {
      if (!tarefaId) return false;

      const id = `delete-${tarefaId}`;
      actionStart(id);
      try {
        const { error } = await supabase
          .from('lead_tarefas_v2')
          .delete()
          .eq('tarefa_id', tarefaId);

        if (error) throw error;

        setTarefas((prev) => prev.filter((t) => t.tarefa_id !== tarefaId));
        toast({
          title: 'Tarefa excluída',
          description: 'A tarefa foi removida com sucesso.',
        });
        return true;
      } catch (error: any) {
        console.error('[useLeadTarefas] deleteTarefa error:', error);
        toast({
          title: 'Erro ao excluir tarefa',
          description: error?.message || 'Não foi possível excluir a tarefa.',
        });
        return false;
      } finally {
        actionEnd();
      }
    },
    [toast]
  );

  const isMine = (tarefa: LeadTarefa): boolean => {
    if (!user) return false;
    if (!tarefa.membro_id) return !user.isMembro;
    if (!user.isMembro) return false;
    return String(tarefa.membro_id) === String(user.membroId ?? '');
  };

  return {
    tarefas,
    loading,
    loadingAction,
    createTarefa,
    updateTarefa,
    toggleConcluida,
    deleteTarefa,
    fetchTarefas,
    isMine,
    isAdmin: user?.isMembro ? user.membro_tipo === 'Administrador' : true,
    membroNomeAtual: user?.nome ?? null,
  };
}

export type TarefaStatus = 'concluida' | 'atrasada' | 'pendente' | 'sem_prazo';

export const getTarefaStatus = (tarefa: Pick<LeadTarefa, 'tarefa_concluida' | 'data_vencimento'>): TarefaStatus => {
  if (tarefa.tarefa_concluida) return 'concluida';
  if (!tarefa.data_vencimento) return 'sem_prazo';
  const d = parseTimestamp(tarefa.data_vencimento);
  if (Number.isNaN(d.getTime())) return 'sem_prazo';
  return d.getTime() < Date.now() ? 'atrasada' : 'pendente';
};
