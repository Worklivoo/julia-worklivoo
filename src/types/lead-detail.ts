import { Lead, Note } from '@/types';

export interface LeadDetailProps {
  leadId: string;
}

export interface LeadHeaderProps {
  lead: Lead;
  onMarkAsSale: () => void;
  onMarkAsLoss: () => void;
  onResumeNegotiation: () => void;
  isUpdating: boolean;
}

export interface StepProgressBarProps {
  currentStage: string;
  onStageChange: (stage: string) => void;
  isUpdating: boolean;
}

export interface NegotiationCardProps {
  lead: Lead;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (data: Partial<Lead>) => void;
  onCancel: () => void;
  isUpdating: boolean;
}

export interface ContactCardProps {
  lead: Lead;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (data: Partial<Lead>) => void;
  onCancel: () => void;
  isUpdating: boolean;
}

export interface AdditionalInfoCardProps {
  lead: Lead;
}

export interface NotesCardProps {
  notes: Note[];
  isLoadingNotes: boolean;
  onAddNote: (content: string) => void;
  isAddingNote: boolean;
}

export interface DeleteCardProps {
  onDelete: () => void;
  isDeleting: boolean;
}

export interface EditableField {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'date';
}

export interface FormData {
  [key: string]: string;
}

export interface UseLeadDetailReturn {
  lead: Lead | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  isDeleting: boolean;
  updateLead: (updates: Partial<Lead>) => Promise<void>;
  deleteLead: () => Promise<void>;
  markAsSale: () => Promise<void>;
  markAsLoss: () => Promise<void>;
  resumeNegotiation: () => Promise<void>;
  changeStage: (stage: string) => Promise<void>;
}

export interface UseNotesReturn {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  isAdding: boolean;
  addNote: (content: string) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

export interface UseLeadActionsReturn {
  handleSaveNegotiation: (data: Partial<Lead>) => void;
  handleSaveContact: (data: Partial<Lead>) => void;
}