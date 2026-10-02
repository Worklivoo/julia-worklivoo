import { UserPlus, PhoneCall, MessageCircle, Handshake, CircleDollarSign, type LucideIcon } from 'lucide-react';

interface Stage {
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
