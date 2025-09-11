import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X } from 'lucide-react';
import { Lead } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface LeadHeaderProps {
  lead: Lead;
  onMarkAsWon: () => void;
  onMarkAsLost: () => void;
  onResumeNegotiation: () => void;
}

export const LeadHeader: React.FC<LeadHeaderProps> = React.memo(({
  lead,
  onMarkAsWon,
  onMarkAsLost,
  onResumeNegotiation,
}) => {
  const isMobile = useIsMobile();

  const renderActionButtons = () => {
    if (lead.status === 'active') {
      return (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onMarkAsWon}
                size={isMobile ? "sm" : "default"}
                className={`${isMobile ? 'flex-1 h-8 px-2 text-xs' : ''} bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg`}
              >
                <Check size={isMobile ? 12 : 16} className="mr-1" />
                {isMobile ? 'Venda' : 'Marcar como Venda'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Marcar esta oportunidade como venda realizada</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={onMarkAsLost}
                size={isMobile ? "sm" : "default"}
                className={`${isMobile ? 'flex-1 h-8 px-2 text-xs' : ''} bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg`}
              >
                <X size={isMobile ? 12 : 16} className="mr-1" />
                {isMobile ? 'Perda' : 'Marcar como Perda'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Marcar esta oportunidade como perdida</p>
            </TooltipContent>
          </Tooltip>
        </>
      );
    }

    if (lead.status === 'won' || lead.status === 'lost') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={onResumeNegotiation} 
              size={isMobile ? "sm" : "default"}
              className={`${isMobile ? 'w-full h-8 px-2 text-xs' : ''} bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg`}
            >
              Retomar Negociação
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reativar esta oportunidade para negociação</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return null;
  };

  return (
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-100/90 via-white to-slate-100/90 dark:from-[#141414]/90 dark:via-[#141414] dark:to-[#141414]/90 p-6 border border-border/50 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5"></div>
      
      {isMobile ? (
        <div className="relative space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {lead.leadName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{lead.opportunityName}</h1>
              <p className="text-sm text-muted-foreground mt-1">{lead.leadName}</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {lead.status === 'active' && (
              <div className="flex gap-2">
                {renderActionButtons()}
              </div>
            )}
            {(lead.status === 'won' || lead.status === 'lost') && renderActionButtons()}
          </div>
        </div>
      ) : (
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {lead.leadName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{lead.opportunityName}</h1>
              <p className="text-sm text-muted-foreground mt-1">{lead.leadName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {renderActionButtons()}
          </div>
        </div>
      )}
    </div>
  );
});

LeadHeader.displayName = 'LeadHeader';