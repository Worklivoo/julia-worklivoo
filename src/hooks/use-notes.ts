import { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Note } from '@/types';

export const useNotes = (leadId: string | undefined) => {
  const { addNote, getNotesByLead } = useCRM();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Carregar anotações do lead
  useEffect(() => {
    const loadNotes = async () => {
      if (!leadId) return;
      
      setIsLoadingNotes(true);
      try {
        const leadNotes = await getNotesByLead(leadId);
        setNotes(leadNotes);
      } catch (error) {
        console.error('Erro ao carregar anotações:', error);
        throw error;
      } finally {
        setIsLoadingNotes(false);
      }
    };

    loadNotes();
  }, [leadId, getNotesByLead]);

  const handleAddNote = async (content: string): Promise<void> => {
    if (!leadId || !content.trim()) return;
    
    const success = await addNote(leadId, content.trim());
    if (success) {
      // Recarregar anotações para mostrar a nova
      const updatedNotes = await getNotesByLead(leadId);
      setNotes(updatedNotes);
    } else {
      throw new Error('Erro ao adicionar anotação');
    }
  };

  return {
    notes,
    isLoadingNotes,
    handleAddNote,
  };
};