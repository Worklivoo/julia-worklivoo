import React, { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Membro, getMembrosByUser, createUserAndAddMembro, updateMembro, deleteMembroComplete } from '@/lib/membros';
import { supabase } from '@/lib/supabase';
import { normalizePhone, normalizeAddMemberPhone } from './phones';

type Feedback = { type: '' | 'success' | 'error'; text: string };
type MembroAlert = { open: boolean; membro: Membro | null };

/**
 * Estado e ações da aba Membros: lista, cadastro, edição, ativar/desativar, excluir e envio do
 * link de redefinição de senha. Só o administrador (ou o usuário master) pode alterar a equipe.
 */
export const useMembros = () => {
  const { user } = useCRM();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewMemberPassword, setShowNewMemberPassword] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Membro | null>(null);
  const [editMemberForm, setEditMemberForm] = useState<{ nome: string; telefone: string }>({ nome: '', telefone: '' });
  const [savingMemberEdit, setSavingMemberEdit] = useState(false);
  const [message, setMessage] = useState<Feedback>({ type: '', text: '' });
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', senha: '' });

  const [deleteAlert, setDeleteAlert] = useState<MembroAlert>({ open: false, membro: null });
  const [deactivateAlert, setDeactivateAlert] = useState<MembroAlert>({ open: false, membro: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const flash = (type: Feedback['type'], text: string, ms: number) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), ms);
  };

  const loadMembros = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Usuário master usa o próprio ID; membro usa o user_id_empresa.
      const userIdToSearch = user.isMembro ? user.user_id_empresa : user.id;
      if (!userIdToSearch) {
        setMembros([]);
        return;
      }

      const result = await getMembrosByUser(userIdToSearch);
      if (result.data) {
        setMembros(result.data);
      } else {
        console.error('Erro ao carregar membros:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembros();
  }, [user]);

  const handleDeleteMembro = async (membro: Membro) => {
    if (membro.membro_tipo === 'Administrador') return;
    setActionLoading(`delete-${membro.membro_id}`);

    try {
      const result = await deleteMembroComplete(membro.membro_id, membro.membro_email);

      if (result.success) {
        setMembros((prev) => prev.filter((m) => m.membro_id !== membro.membro_id));
        flash('success', 'Membro excluído com sucesso!', 3000);
      } else {
        flash('error', 'Erro ao excluir membro: ' + (result.error?.message || 'Erro desconhecido'), 5000);
      }
    } catch (error) {
      console.error('Erro ao excluir membro:', error);
      flash('error', 'Erro inesperado ao excluir membro', 5000);
    } finally {
      setActionLoading(null);
      setDeleteAlert({ open: false, membro: null });
    }
  };

  const handleDeactivateMembro = async (membro: Membro) => {
    if (membro.membro_tipo === 'Administrador') return;
    setActionLoading(`deactivate-${membro.membro_id}`);

    try {
      const result = await updateMembro(membro.membro_id, { membro_status: 'Desativado' });

      if (result.data) {
        setMembros((prev) => prev.map((m) => (m.membro_id === membro.membro_id ? { ...m, membro_status: 'Desativado' } : m)));
        flash('success', 'Membro desativado com sucesso!', 3000);
      } else {
        flash('error', 'Erro ao desativar membro: ' + (result.error?.message || 'Erro desconhecido'), 5000);
      }
    } catch (error) {
      console.error('Erro ao desativar membro:', error);
      flash('error', 'Erro inesperado ao desativar membro', 5000);
    } finally {
      setActionLoading(null);
      setDeactivateAlert({ open: false, membro: null });
    }
  };

  const handleReactivateMembro = async (membro: Membro) => {
    if (membro.membro_tipo === 'Administrador') return;
    setActionLoading(`reactivate-${membro.membro_id}`);

    try {
      const result = await updateMembro(membro.membro_id, { membro_status: 'Ativado' });

      if (result.data) {
        setMembros((prev) => prev.map((m) => (m.membro_id === membro.membro_id ? { ...m, membro_status: 'Ativado' } : m)));
        flash('success', 'Membro reativado com sucesso!', 3000);
      } else {
        flash('error', 'Erro ao reativar membro: ' + (result.error?.message || 'Erro desconhecido'), 5000);
      }
    } catch (error) {
      console.error('Erro ao reativar membro:', error);
      flash('error', 'Erro inesperado ao reativar membro', 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendResetPasswordLink = async (membro: Membro) => {
    const email = String(membro.membro_email || '').trim();
    if (!email) {
      flash('error', 'Este membro não possui e-mail cadastrado.', 3000);
      return;
    }

    setOpenMenuId(null);
    setActionLoading(`reset-${membro.membro_id}`);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        flash('error', 'Erro ao enviar link de redefinição. Tente novamente.', 5000);
        return;
      }

      flash('success', `Link de redefinição enviado para ${email}.`, 3000);
    } catch {
      flash('error', 'Erro inesperado ao enviar link de redefinição.', 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const openEditMemberDialog = (membro: Membro) => {
    setOpenMenuId(null);
    setEditingMember(membro);
    setEditMemberForm({
      nome: String(membro.membro_nome || ''),
      telefone: String(membro.membro_telefone || ''),
    });
    setEditMemberOpen(true);
  };

  const closeEditMemberDialog = (open: boolean) => {
    setEditMemberOpen(open);
    if (!open) {
      setEditingMember(null);
      setSavingMemberEdit(false);
    }
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const membro = editingMember;
    if (!membro) return;
    if (savingMemberEdit) return;

    const nome = editMemberForm.nome.trim();
    const telefone = normalizePhone(editMemberForm.telefone);
    if (!nome) {
      flash('error', 'O nome é obrigatório.', 3000);
      return;
    }

    setSavingMemberEdit(true);
    try {
      const result = await updateMembro(membro.membro_id, {
        membro_nome: nome,
        membro_telefone: telefone ? telefone : null,
      });

      if (result.data) {
        setMembros((prev) =>
          prev.map((m) =>
            m.membro_id === membro.membro_id ? { ...m, membro_nome: nome, membro_telefone: telefone ? telefone : null } : m
          )
        );
        setEditMemberOpen(false);
        setEditingMember(null);
        flash('success', 'Membro atualizado com sucesso!', 3000);
      } else {
        flash('error', 'Erro ao atualizar membro: ' + ((result as any)?.error?.message || 'Erro desconhecido'), 5000);
      }
    } catch {
      flash('error', 'Erro inesperado ao atualizar membro', 5000);
    } finally {
      setSavingMemberEdit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.email || !formData.telefone || !formData.senha) {
      flash('error', 'Todos os campos são obrigatórios', 3000);
      return;
    }

    if (!user) {
      flash('error', 'Usuário não encontrado', 3000);
      return;
    }

    setIsLoading(true);

    try {
      const normalizedPhone = `55${normalizeAddMemberPhone(formData.telefone)}`;
      const result = await createUserAndAddMembro(
        formData.email,
        formData.senha,
        formData.nome,
        normalizedPhone,
        'Usuario',
        'Ativado',
        user.isMembro ? user.user_id_empresa : user.id
      );

      if (result.success) {
        setFormData({ nome: '', email: '', telefone: '', senha: '' });
        setShowNewMemberPassword(false);
        setIsDialogOpen(false);
        loadMembros();
        flash('success', 'Membro adicionado com sucesso!', 3000);
      } else {
        flash('error', result.error?.message || 'Erro ao adicionar membro', 5000);
      }
    } catch (error) {
      console.error('Erro ao adicionar membro:', error);
      flash('error', 'Erro inesperado ao adicionar membro', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const canAddMembers = () => {
    if (!user) return false;

    // Usuário master (tabela usuarios) sempre pode.
    if (!user.isMembro) return true;

    // Membro: só administradores podem adicionar/alterar a equipe.
    const currentMember = membros.find(
      (m) => String(m.membro_email || '').toLowerCase() === String(user.email || '').toLowerCase()
    );
    if (!currentMember) return false;
    return currentMember.membro_tipo === 'Administrador';
  };

  const visibleMembros = membros.filter((m) => m.membro_tipo !== 'Administrador');

  return {
    loading,
    message,
    visibleMembros,
    canAddMembers,
    actionLoading,
    openMenuId,
    setOpenMenuId,
    isDialogOpen,
    setIsDialogOpen,
    isLoading,
    formData,
    setFormData,
    showNewMemberPassword,
    setShowNewMemberPassword,
    handleSubmit,
    editMemberOpen,
    closeEditMemberDialog,
    editMemberForm,
    setEditMemberForm,
    savingMemberEdit,
    openEditMemberDialog,
    handleSaveEditMember,
    deleteAlert,
    setDeleteAlert,
    deactivateAlert,
    setDeactivateAlert,
    handleDeleteMembro,
    handleDeactivateMembro,
    handleReactivateMembro,
    handleSendResetPasswordLink,
  };
};

export type MembrosCtx = ReturnType<typeof useMembros>;
