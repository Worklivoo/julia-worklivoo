import { useCallback } from 'react';
import { Lead } from '@/types';

interface UseLeadActionsProps {
  onUpdateLead: (updates: Partial<Lead>) => void;
}

export const useLeadActions = ({ onUpdateLead }: UseLeadActionsProps) => {
  const handleSaveNegotiation = useCallback((data: Partial<Lead>) => {
    onUpdateLead({
      opportunityName: data.opportunityName,
      source: data.source,
    });
  }, [onUpdateLead]);

  const handleSaveContact = useCallback((data: Partial<Lead>) => {
    onUpdateLead({
      leadName: data.leadName,
      email: data.email,
      phone: data.phone,
      expectedCloseDate: data.expectedCloseDate,
    });
  }, [onUpdateLead]);

  return {
    handleSaveNegotiation,
    handleSaveContact,
  };
};