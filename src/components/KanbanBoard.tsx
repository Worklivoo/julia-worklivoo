import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCRM } from '@/contexts/CRMContext';
import { Lead } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Star, MessageCircle, Handshake, CircleDollarSign, Zap, Send, ListTodo, AlertTriangle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const stages = [
  { id: 'entrada', name: 'Entrada do Lead', icon: User, aiDriven: true },
  { id: 'tentando-contato', name: 'Tentando Contato', icon: Phone, aiDriven: true },
  { id: 'contato-realizado', name: 'Contato Realizado', icon: MessageCircle, aiDriven: true },
  { id: 'qualificada', name: 'Oportunidade Qualificada', icon: Star, aiDriven: false },
  { id: 'orcamento-negociacao', name: 'Orçamento/Negociação', icon: Handshake, aiDriven: false },
  { id: 'venda', name: 'Venda', icon: CircleDollarSign, aiDriven: false },
];

interface KanbanBoardProps {
  leads: Lead[];
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads }) => {
  const { updateLead } = useCRM();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const cid = `kanban-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const comStats = leads.filter((l) => Number(l._tarefas_total ?? 0) > 0);
    console.log(
      `[KanbanBoard][${cid}] Recebendo ${leads.length} leads. Desses, ${comStats.length} tem _tarefas_total > 0.`,
      comStats.length > 0
        ? Object.fromEntries(
            comStats.map((l) => [
              `lead_${l.id}`,
              {
                nome: l.leadName || l.opportunityName,
                _tarefas_total: l._tarefas_total,
                _tarefas_atrasadas: l._tarefas_atrasadas,
              },
            ])
          )
        : 'Nenhum lead com stats de tarefa recebido.'
    );
  }, [leads]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStage = result.destination.droppableId;
    updateLead(leadId, { stage: newStage as Lead['stage'] });
  };

  const FollowupDinamicoBadge: React.FC<{ lead: Lead }> = ({ lead }) => {
    if (!Boolean(lead.followup_dinamico)) return null;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label="FollowUp Dinâmico enviado"
            title="FollowUp Dinâmico enviado"
            className="pointer-events-auto absolute top-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-orange-200/70 dark:border-amber-500/20 bg-gradient-to-br from-amber-100/80 via-orange-100/80 to-rose-100/80 dark:from-amber-500/15 dark:via-orange-500/15 dark:to-rose-500/15 shadow-sm text-orange-600 dark:text-amber-400"
          >
            <Send className="h-3 w-3" strokeWidth={2.25} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="text-xs max-w-xs">
          Este lead recebeu FollowUp Dinâmico.
        </TooltipContent>
      </Tooltip>
    );
  };

  const LeadTarefasBadge: React.FC<{ lead: Lead; size?: 'sm' | 'md' }> = ({ lead, size = 'md' }) => {
    const atrasadas = Math.max(0, Number(lead._tarefas_atrasadas ?? 0));
    if (atrasadas <= 0) return null;

    const isSm = size === 'sm';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={[
              'inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-semibold tabular-nums select-none border bg-red-500 text-white border-red-500/80',
              isSm
                ? 'h-4 min-w-[16px] px-1.5 text-[10px]'
                : 'h-5 min-w-[20px] px-2 text-[11px]',
            ].join(' ')}
            aria-label={`${atrasadas} tarefa(s) atrasada(s)`}
          >
            <AlertTriangle className={isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.25} />
            <span>{atrasadas}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="text-xs max-w-xs">
          {atrasadas} tarefa(s) atrasada(s)
        </TooltipContent>
      </Tooltip>
    );
  };

  const getCardBackground = (lead: Lead) => {
    if (lead.status === 'lost') {
      return 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 dark:from-red-950/70 dark:to-red-900/50 dark:border-red-800/70';
    }
    if (lead.status === 'won') {
      return 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:from-green-950/70 dark:to-green-900/50 dark:border-green-800/70';
    }
    return 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800';
  };

  if (isMobile) {
    // Versão Mobile com scroll horizontal
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          {stages.map((stage) => {
            const stageLeads = leads.filter(lead => lead.stage === stage.id);
            const totalValue = stageLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
            const IconComponent = stage.icon;

            return (
              <Droppable droppableId={stage.id} key={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-lg p-4 h-[70vh] flex flex-col min-w-[320px] max-w-[320px] w-[320px] flex-shrink-0 ${
                      snapshot.isDraggingOver ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-black'
                    }`}
                  >
                    {/* Header da coluna */}
                    <div className="flex flex-col gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-start gap-2">
                        <IconComponent size={18} className="text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate">
                            {stage.name}
                          </h3>
                          {stage.aiDriven && (
                            <Badge
                              className="inline-flex items-center gap-1 border-0 text-[10px] font-semibold uppercase tracking-wide shrink-0"
                              style={{ backgroundColor: '#EBF57D', color: '#000000' }}
                            >
                              <Zap className="h-3 w-3" />
                              IA
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                          {stageLeads.length}
                        </Badge>
                      </div>
                      <div className="pl-6 flex items-center justify-between">
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#111111' }}>
                        {totalValue.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    </div>

                    {/* Cards dos leads */}
                    <div className="space-y-4 flex-1 overflow-y-auto scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                      {stageLeads.map((lead, idx) => (
                        <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                          {(provided, snapshot) => (
                            <Card
                               ref={provided.innerRef}
                               {...provided.draggableProps}
                               {...provided.dragHandleProps}
                               className={`${
                                 getCardBackground(lead)
                               } cursor-pointer hover:shadow-md transition-all duration-200 min-h-[120px] relative ${
                                 snapshot.isDragging ? 'shadow-lg rotate-1 scale-105' : ''
                               }`}
                               onClick={() => navigate(`/lead/${lead.id}`)}
                             >
                               <TooltipProvider delayDuration={150}>
                                 <FollowupDinamicoBadge lead={lead} />
                               </TooltipProvider>
                               <CardHeader className="p-4">
                                 <div className="flex flex-col space-y-3">
                                   <div className="flex items-center gap-3">
                                     <Avatar className="h-12 w-12 flex-shrink-0">
                                        <AvatarFallback className="text-base font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                                          {lead.leadName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                     <div className="flex-1 min-w-0">
                                       <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-2">
                                         {lead.opportunityName}
                                       </CardTitle>
                                       <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-1">
                                         {lead.leadName}
                                       </p>
                                       <div className="flex items-center justify-between gap-2">
                                         <p className="text-[11px] leading-relaxed tabular-nums shrink-0" style={{ color: '#111111' }}>
                                           {(Number(lead.value) || 0).toLocaleString('pt-BR', {
                                             style: 'currency',
                                             currency: 'BRL',
                                             maximumFractionDigits: 2,
                                           })}
                                         </p>
                                         <LeadTarefasBadge lead={lead} size="md" />
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               </CardHeader>
                             </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    );
  }

  // Versão Desktop (mantida original)
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 w-full" style={{ scrollbarWidth: 'thin' }}>
        {stages.map((stage) => {
          const stageLeads = leads.filter(lead => lead.stage === stage.id);
          const totalValue = stageLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
          const IconComponent = stage.icon;

          return (
            <Droppable droppableId={stage.id} key={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-lg p-4 h-[600px] flex flex-col min-w-[320px] max-w-[320px] w-[320px] flex-shrink-0 ${
                    snapshot.isDraggingOver ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-black'
                  }`}
                >
                  {/* Header da coluna */}
                  <div className="flex flex-col gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-2">
                      <IconComponent size={16} className="text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                          {stage.name}
                        </h3>
                        {stage.aiDriven && (
                          <Badge
                            className="inline-flex items-center gap-1 border-0 text-[10px] font-semibold uppercase tracking-wide shrink-0"
                            style={{ backgroundColor: '#EBF57D', color: '#000000' }}
                          >
                            <Zap className="h-3 w-3" />
                            IA
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="ml-auto text-xs shrink-0">
                        {stageLeads.length}
                      </Badge>
                    </div>
                    <div className="pl-5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#111111' }}>
                        {totalValue.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Cards dos leads */}
                  <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                    {stageLeads.map((lead, idx) => (
                      <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                        {(provided, snapshot) => (
                          <Card
                             ref={provided.innerRef}
                             {...provided.draggableProps}
                             {...provided.dragHandleProps}
                             className={`${
                               getCardBackground(lead)
                             } cursor-pointer hover:shadow-md transition-all duration-200 min-h-[100px] relative ${
                               snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : ''
                             }`}
                             onClick={() => navigate(`/lead/${lead.id}`)}
                           >
                             <TooltipProvider delayDuration={150}>
                               <FollowupDinamicoBadge lead={lead} />
                             </TooltipProvider>
                             <CardHeader className="p-4">
                               <div className="flex flex-col space-y-3">
                                 <div className="flex items-center gap-3">
                                   <Avatar className="h-10 w-10 flex-shrink-0">
                                      <AvatarFallback className="text-sm font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                                       {(lead.leadName || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                     </AvatarFallback>
                                    </Avatar>
                                   <div className="flex-1 min-w-0">
                                     <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                                       {lead.opportunityName}
                                     </CardTitle>
                                     <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-1">
                                       {lead.leadName}
                                     </p>
                                     <div className="flex items-center justify-between gap-2">
                                       <p className="text-[10px] leading-relaxed tabular-nums shrink-0" style={{ color: '#111111' }}>
                                         {(Number(lead.value) || 0).toLocaleString('pt-BR', {
                                           style: 'currency',
                                           currency: 'BRL',
                                           maximumFractionDigits: 2,
                                         })}
                                       </p>
                                       <LeadTarefasBadge lead={lead} size="sm" />
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             </CardHeader>
                           </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
