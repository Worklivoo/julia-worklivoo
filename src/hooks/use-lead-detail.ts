import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { Lead } from '@/types';

export const useLeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, updateLead, deleteLead } = useCRM();
  const [editedLead, setEditedLead] = useState<Lead | null>(null);

  const lead = leads.find(l => l.id === id);

  useEffect(() => {
    if (lead) {
      setEditedLead(lead);
    }
  }, [lead]);

  const handleUpdateLead = (updates: Partial<Lead>) => {
    if (id) {
      updateLead(id, updates);
    }
  };

  const handleDeleteLead = async (): Promise<void> => {
    if (!id) return;
    
    const success = await deleteLead(id);
    if (success) {
      navigate('/leads');
    } else {
      throw new Error('Erro ao excluir lead');
    }
  };

  const handleMarkAsWon = () => {
    handleUpdateLead({ status: 'won' });
  };

  const handleMarkAsLost = () => {
    handleUpdateLead({ status: 'lost' });
  };

  const handleResumeNegotiation = () => {
    handleUpdateLead({ status: 'active' });
  };

  const handleStageChange = (newStage: string) => {
    handleUpdateLead({ stage: newStage as any });
  };

  return {
    lead,
    editedLead,
    setEditedLead,
    handleUpdateLead,
    handleDeleteLead,
    handleMarkAsWon,
    handleMarkAsLost,
    handleResumeNegotiation,
    handleStageChange,
    navigate,
  };
};