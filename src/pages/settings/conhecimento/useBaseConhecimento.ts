import { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useToast } from '@/hooks/use-toast';
import {
  addBaseConhecimentoV2,
  deleteBaseConhecimentoV2,
  getBaseConhecimentoV2ByUser,
  updateBaseConhecimentoV2,
} from '@/lib/supabase-utils';

export type ConhecimentoItem = {
  conhecimento_id: number;
  user_id: string;
  pergunta: string;
  resposta: string;
  criado_em: string;
  ativo_inativo: boolean | null;
};

/**
 * Perguntas e respostas que a IA usa no atendimento: carrega, cria, edita, ativa/desativa e remove.
 * Só administradores (ou o usuário master) alteram a base; membros comuns apenas leem.
 */
export const useBaseConhecimento = () => {
  const { user } = useCRM();
  const { toast } = useToast();

  const [items, setItems] = useState<ConhecimentoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ConhecimentoItem | null>(null);

  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');

  const count = items.length;

  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (!user.isMembro) return true;
    return user.membro_tipo === 'Administrador';
  }, [user]);

  const userIdForKnowledgeBase = useMemo(() => {
    if (!user) return '';
    return user.isMembro ? user.user_id_empresa || '' : user.id;
  }, [user]);

  const load = async () => {
    if (!user) return;
    if (!userIdForKnowledgeBase) return;
    setLoading(true);
    const { data, error } = await getBaseConhecimentoV2ByUser(userIdForKnowledgeBase);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao carregar', description: 'Não foi possível buscar sua base de conhecimento.' });
      return;
    }
    setItems((data ?? []) as ConhecimentoItem[]);
  };

  useEffect(() => {
    load();
  }, [user?.id, user?.user_id_empresa, userIdForKnowledgeBase]);

  const resetForm = () => {
    setPergunta('');
    setResposta('');
  };

  const openCreate = () => {
    if (!isAdmin) return;
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (item: ConhecimentoItem) => {
    if (!isAdmin) return;
    setSelected(item);
    setPergunta(item.pergunta || '');
    setResposta(item.resposta || '');
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setSelected(null);
    resetForm();
  };

  const openDelete = (item: ConhecimentoItem) => {
    if (!isAdmin) return;
    setSelected(item);
    setDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!user || !isAdmin) return;
    const p = pergunta.trim();
    const r = resposta.trim();
    if (!p || !r) {
      toast({ title: 'Preencha os campos', description: 'Pergunta e resposta são obrigatórias.' });
      return;
    }

    setSaving(true);
    const { data, error } = await addBaseConhecimentoV2({
      user_id: userIdForKnowledgeBase,
      pergunta: p,
      resposta: r,
      ativo_inativo: true,
    });
    setSaving(false);

    if (error || !data) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível adicionar a pergunta.' });
      return;
    }

    setItems((prev) => [data as ConhecimentoItem, ...prev]);
    setCreateOpen(false);
    resetForm();
    toast({ title: 'Adicionado', description: 'Pergunta e resposta salvas.' });
  };

  const handleEdit = async () => {
    if (!user || !selected || !isAdmin) return;
    const p = pergunta.trim();
    const r = resposta.trim();
    if (!p || !r) {
      toast({ title: 'Preencha os campos', description: 'Pergunta e resposta são obrigatórias.' });
      return;
    }

    setSaving(true);
    const { data, error } = await updateBaseConhecimentoV2({
      userId: userIdForKnowledgeBase,
      conhecimentoId: selected.conhecimento_id,
      updates: { pergunta: p, resposta: r },
    });
    setSaving(false);

    if (error || !data) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar a pergunta.' });
      return;
    }

    setItems((prev) => prev.map((it) => (it.conhecimento_id === selected.conhecimento_id ? (data as ConhecimentoItem) : it)));
    setEditOpen(false);
    setSelected(null);
    resetForm();
    toast({ title: 'Atualizado', description: 'Alterações salvas.' });
  };

  const handleToggleStatus = async (item: ConhecimentoItem, checked: boolean) => {
    if (!user || !isAdmin) return;
    const { data, error } = await updateBaseConhecimentoV2({
      userId: userIdForKnowledgeBase,
      conhecimentoId: item.conhecimento_id,
      updates: { ativo_inativo: checked },
    });

    if (error || !data) {
      toast({ title: 'Erro ao atualizar', description: 'Não foi possível alterar o status da pergunta.' });
      return;
    }

    setItems((prev) => prev.map((it) => (it.conhecimento_id === item.conhecimento_id ? (data as ConhecimentoItem) : it)));
    toast({ title: 'Status atualizado', description: `Pergunta ${checked ? 'ativada' : 'desativada'} com sucesso.` });
  };

  const handleDelete = async () => {
    if (!user || !selected || !isAdmin) return;
    setSaving(true);
    const { error } = await deleteBaseConhecimentoV2({ userId: userIdForKnowledgeBase, conhecimentoId: selected.conhecimento_id });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao remover', description: 'Não foi possível remover a pergunta.' });
      return;
    }
    setItems((prev) => prev.filter((it) => it.conhecimento_id !== selected.conhecimento_id));
    setDeleteOpen(false);
    setSelected(null);
    toast({ title: 'Removido', description: 'Pergunta excluída.' });
  };

  return {
    items,
    loading,
    count,
    isAdmin,
    createOpen,
    setCreateOpen,
    editOpen,
    closeEdit,
    deleteOpen,
    setDeleteOpen,
    saving,
    pergunta,
    setPergunta,
    resposta,
    setResposta,
    openCreate,
    openEdit,
    openDelete,
    handleCreate,
    handleEdit,
    handleToggleStatus,
    handleDelete,
  };
};

export type BaseConhecimentoCtx = ReturnType<typeof useBaseConhecimento>;
