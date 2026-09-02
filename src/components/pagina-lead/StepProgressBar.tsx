import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, UserPlus, PhoneCall, MessageCircle, Handshake, CircleDollarSign, type LucideIcon } from 'lucide-react';
import { Lead } from '@/types';

interface Stage {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface StepProgressBarProps {
  lead: Lead;
  onStageChange: (stage: string) => void;
}

const stages: Stage[] = [
  { id: 'entrada', name: 'Entrada do Lead', icon: UserPlus },
  { id: 'tentando-contato', name: 'Tentando Contato', icon: PhoneCall },
  { id: 'contato-realizado', name: 'Contato Realizado', icon: MessageCircle },
  { id: 'qualificada', name: 'Oportunidade Qualificada', icon: Handshake },
  { id: 'orcamento-negociacao', name: 'Orçamento/Negociação', icon: Handshake },
  { id: 'venda', name: 'Venda', icon: CircleDollarSign },
];

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ lead, onStageChange }) => {
  const currentStageIndex = stages.findIndex(stage => stage.id === lead.stage);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = idx === currentStageIndex;
          const isCompleted = idx < currentStageIndex;
          
          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={lead.status !== 'active'}
                      onClick={() => lead.status === 'active' && onStageChange(stage.id)}
                      className={`flex items-center justify-center rounded-full w-8 h-8 mb-2 transition-colors
                        ${isActive ? 'text-black dark:text-black' : 
                          isCompleted ? 'bg-green-600 text-white' : 
                          'bg-muted text-muted-foreground'}
                        ${lead.status === 'active' ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                      style={isActive ? {backgroundColor: '#EBF57D'} : {}}
                    >
                      {isCompleted ? <CheckCircle size={16} /> : <Icon size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{stage.name}</p>
                  </TooltipContent>
                </Tooltip>
                <span className={`text-xs text-center ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {stage.name}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className={`h-px flex-1 mx-2 ${isCompleted ? 'bg-green-600' : 'bg-border'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
