import React, { useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Lead } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Star, MessageCircle, Handshake, CircleDollarSign, Zap, Send, AlertTriangle, Clock } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';

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

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

// "há 5 min", "há 3 h", "há 2 d"; passando de 30 dias mostra a data.
const formatRelative = (date: Date) => {
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD <= 30) return `há ${diffD} d`;
  return new Date(date).toLocaleDateString('pt-BR');
};

// Só o nome da pessoa; sem nome cadastrado, cai para o telefone e depois para a oportunidade.
const getLeadTitle = (lead: Lead) => {
  const name = (lead.leadName || '').trim();
  if (name && name !== 'N/A') return name;
  return (lead.phone || '').trim() || lead.opportunityName || 'Sem nome';
};

const isIaPaused = (lead: Lead) => String(lead.ativo_ia || '').trim().toUpperCase().replace('Ã', 'A') === 'NAO';

const FollowupDinamicoBadge: React.FC<{ lead: Lead }> = ({ lead }) => {
  if (!Boolean(lead.followup_dinamico)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="wl-lead__fu" aria-label="FollowUp Dinâmico enviado">
          <Send aria-hidden="true" strokeWidth={2.25} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="wl-scope wl-tip">
        Este lead recebeu FollowUp Dinâmico.
      </TooltipContent>
    </Tooltip>
  );
};

const LeadTarefasBadge: React.FC<{ lead: Lead }> = ({ lead }) => {
  const atrasadas = Math.max(0, Number(lead._tarefas_atrasadas ?? 0));
  if (atrasadas <= 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="wl-tag wl-tag--alert" aria-label={`${atrasadas} tarefa(s) atrasada(s)`}>
          <AlertTriangle aria-hidden="true" strokeWidth={2.25} />
          {atrasadas}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="wl-scope wl-tip">
        {atrasadas} tarefa(s) atrasada(s)
      </TooltipContent>
    </Tooltip>
  );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads }) => {
  const { updateLead } = useCRM();
  const navigate = useNavigate();

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

  return (
    <TooltipProvider delayDuration={150}>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="wl-board">
          {stages.map((stage) => {
            const stageLeads = leads.filter((lead) => lead.stage === stage.id);
            const totalValue = stageLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
            const IconComponent = stage.icon;

            return (
              <Droppable droppableId={stage.id} key={stage.id}>
                {(provided, snapshot) => (
                  <section
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`wl-col ${snapshot.isDraggingOver ? 'is-over' : ''}`}
                    aria-label={stage.name}
                  >
                    <header className="wl-col__head">
                      <IconComponent className="wl-col__icon" aria-hidden="true" />
                      <h3 className="wl-col__name">{stage.name}</h3>
                      {stage.aiDriven && (
                        <span className="wl-chip">
                          <Zap aria-hidden="true" />
                          IA
                        </span>
                      )}
                      <span className="wl-col__count">{stageLeads.length}</span>
                    </header>
                    {totalValue > 0 && <p className="wl-col__total">{formatBRL(totalValue)}</p>}

                    <div className="wl-col__list">
                      {stageLeads.map((lead, idx) => {
                        const value = Number(lead.value) || 0;
                        return (
                          <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                            {(provided, snapshot) => (
                              <article
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={[
                                  'wl-lead',
                                  lead.status === 'lost' ? 'wl-lead--lost' : '',
                                  lead.followup_dinamico ? 'wl-lead--fu' : '',
                                  snapshot.isDragging ? 'is-dragging' : '',
                                ].join(' ').trim()}
                                onClick={() => navigate(`/lead/${lead.id}`)}
                              >
                                <FollowupDinamicoBadge lead={lead} />
                                <h4 className="wl-lead__name">{getLeadTitle(lead)}</h4>
                                {(lead.source || isIaPaused(lead)) && (
                                  <div className="wl-lead__meta">
                                    {lead.source && <span className="wl-pill" title={`Origem: ${lead.source}`}>{lead.source}</span>}
                                    {isIaPaused(lead) && <span className="wl-tag wl-tag--idle">IA pausada</span>}
                                  </div>
                                )}
                                <div className="wl-lead__foot">
                                  <time
                                    className="wl-lead__time"
                                    dateTime={new Date(lead.updatedAt).toISOString()}
                                    title={`Última interação em ${new Date(lead.updatedAt).toLocaleString('pt-BR')}`}
                                  >
                                    <Clock aria-hidden="true" />
                                    Interação {formatRelative(lead.updatedAt)}
                                  </time>
                                  <div className="wl-lead__end">
                                    {value > 0 && <span className="wl-lead__value">{formatBRL(value)}</span>}
                                    {lead.status === 'won' && <span className="wl-tag wl-tag--won">Vendido</span>}
                                    {lead.status === 'lost' && <span className="wl-tag wl-tag--lost">Perdido</span>}
                                    <LeadTarefasBadge lead={lead} />
                                  </div>
                                </div>
                              </article>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {stageLeads.length === 0 && <p className="wl-col__empty">Nenhum lead</p>}
                    </div>
                  </section>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </TooltipProvider>
  );
};

export default KanbanBoard;
