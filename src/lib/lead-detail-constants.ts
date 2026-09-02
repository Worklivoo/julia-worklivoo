import { UserPlus, PhoneCall, MessageCircle, Handshake, CircleDollarSign, type LucideIcon } from 'lucide-react';

export interface Stage {
  id: string;
  name: string;
  icon: LucideIcon;
}

export const PIPELINE_STAGES: Stage[] = [
  { id: 'entrada', name: 'Entrada do Lead', icon: UserPlus },
  { id: 'tentando-contato', name: 'Tentando Contato', icon: PhoneCall },
  { id: 'contato-realizado', name: 'Contato Realizado', icon: MessageCircle },
  { id: 'qualificada', name: 'Oportunidade Qualificada', icon: Handshake },
  { id: 'orcamento-negociacao', name: 'Orçamento/Negociação', icon: Handshake },
  { id: 'venda', name: 'Venda', icon: CircleDollarSign },
];

export const NOTE_TRUNCATE_LENGTH = 200;

export const DIALOG_SIZES = {
  mobile: {
    width: 'w-[95vw]',
    height: 'h-[90vh]',
    textareaHeight: 'h-[60vh]',
    textareaRows: 20,
  },
  desktop: {
    width: 'w-[60vw]',
    height: 'h-[75vh]',
    textareaHeight: 'h-[45vh]',
    textareaRows: 16,
  },
} as const;
