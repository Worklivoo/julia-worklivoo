import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  LeadHeader,
  StepProgressBar,
  NegotiationCard,
  ContactCard,
  AdditionalInfoCard,
  NotesCard,
  DeleteCard
} from '@/components/pagina-lead';

import { useLeadDetail } from '@/hooks/use-lead-detail';
import { useNotes } from '@/hooks/use-notes';
import { useLeadActions } from '@/hooks/use-lead-actions';

import type { LeadDetailProps } from '@/types/lead-detail';

const LeadDetailRefactored: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Estados locais para controle de edição
  const [isEditingNegotiation, setIsEditingNegotiation] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  
  // Hooks customizados
  const {
    lead,
    isLoading,
    error,
    isUpdating,
    isDeleting,
    updateLead,
    deleteLead,
    markAsSale,
    markAsLoss,
    resumeNegotiation,
    changeStage
  } = useLeadDetail(id!);
  
  const {
    notes,
    isLoading: isLoadingNotes,
    isAdding: isAddingNote,
    addNote
  } = useNotes(id!);
  
  const { handleSaveNegotiation, handleSaveContact } = useLeadActions({
    onUpdateLead: updateLead
  });

  // Handlers para edição otimizados com useCallback
  const handleEditNegotiation = useCallback(() => setIsEditingNegotiation(true), []);
  const handleCancelNegotiationEdit = useCallback(() => setIsEditingNegotiation(false), []);
  const handleSaveNegotiationEdit = useCallback(async (data: any) => {
    try {
      await handleSaveNegotiation(data);
      setIsEditingNegotiation(false);
      toast.success('Informações da negociação atualizadas!');
    } catch (error) {
      toast.error('Erro ao atualizar informações da negociação');
    }
  }, [handleSaveNegotiation]);

  const handleEditContact = useCallback(() => setIsEditingContact(true), []);
  const handleCancelContactEdit = useCallback(() => setIsEditingContact(false), []);
  const handleSaveContactEdit = useCallback(async (data: any) => {
    try {
      await handleSaveContact(data);
      setIsEditingContact(false);
      toast.success('Informações de contato atualizadas!');
    } catch (error) {
      toast.error('Erro ao atualizar informações de contato');
    }
  }, [handleSaveContact]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteLead();
      toast.success('Lead excluído com sucesso!');
      navigate('/leads');
    } catch (error) {
      toast.error('Erro ao excluir lead');
    }
  }, [deleteLead, navigate]);

  const handleAddNote = useCallback(async (content: string) => {
    try {
      await addNote(content);
      toast.success('Anotação adicionada com sucesso!');
    } catch (error) {
      toast.error('Erro ao adicionar anotação');
    }
  }, [addNote]);

  const handleStageChange = useCallback(async (stage: string) => {
    try {
      await changeStage(stage);
      toast.success('Estágio atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar estágio');
    }
  }, [changeStage]);

  // Estados de carregamento
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Carregando...</h1>
        </div>
      </div>
    );
  }
  
  if (error || !lead) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{error || 'Lead não encontrado'}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header com navegação */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Detalhes do Lead</h1>
      </div>

      {/* Header do Lead com ações */}
      <LeadHeader
        lead={lead}
        onMarkAsSale={markAsSale}
        onMarkAsLoss={markAsLoss}
        onResumeNegotiation={resumeNegotiation}
        isUpdating={isUpdating}
      />

      {/* Barra de Progresso - apenas no desktop */}
      <div className="hidden md:block">
        <StepProgressBar
          currentStage={lead.stage}
          onStageChange={handleStageChange}
          isUpdating={isUpdating}
        />
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informações da Negociação */}
        <NegotiationCard
          lead={lead}
          isEditing={isEditingNegotiation}
          onEdit={handleEditNegotiation}
          onSave={handleSaveNegotiationEdit}
          onCancel={handleCancelNegotiationEdit}
          isUpdating={isUpdating}
        />

        {/* Informações de Contato */}
        <ContactCard
          lead={lead}
          isEditing={isEditingContact}
          onEdit={handleEditContact}
          onSave={handleSaveContactEdit}
          onCancel={handleCancelContactEdit}
          isUpdating={isUpdating}
        />

        {/* Informações Adicionais */}
        <AdditionalInfoCard lead={lead} />

        {/* Anotações */}
        <NotesCard
          notes={notes}
          isLoadingNotes={isLoadingNotes}
          onAddNote={handleAddNote}
          isAddingNote={isAddingNote}
        />
      </div>

      {/* Zona de Risco - Exclusão */}
      <DeleteCard
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default LeadDetailRefactored;