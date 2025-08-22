import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCRM } from '@/contexts/CRMContext';
import { Lead } from '@/types';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Star } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useIsMobile } from '@/hooks/use-mobile';

const stages = [
  { id: 'entrada', name: 'Entrada do Lead', icon: User },
  { id: 'tentando-contato', name: 'Tentando Contato', icon: Phone },
  { id: 'contato-realizado', name: 'Contato Realizado', icon: Mail },
  { id: 'qualificada', name: 'Oportunidade Qualificada', icon: Star },
];

interface KanbanBoardProps {
  leads: Lead[];
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads }) => {
  const { updateLead } = useCRM();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStage = result.destination.droppableId;
    updateLead(leadId, { stage: newStage as Lead['stage'] });
  };

  const getCardBackground = (lead: Lead) => {
    if (lead.status === 'lost') {
      return 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 dark:from-red-950/50 dark:to-red-900/30 dark:border-red-800/50';
    }
    if (lead.status === 'won') {
      return 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:from-green-950/50 dark:to-green-900/30 dark:border-green-800/50';
    }
    return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  if (isMobile) {
    // Versão Mobile com scroll horizontal
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          {stages.map((stage) => {
            const stageLeads = leads.filter(lead => lead.stage === stage.id);
            const IconComponent = stage.icon;

            return (
              <Droppable droppableId={stage.id} key={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-lg p-4 h-[70vh] flex flex-col min-w-[300px] max-w-[300px] w-[300px] flex-shrink-0 ${
                      snapshot.isDraggingOver ? 'bg-[#F6F6F6] dark:bg-gray-800' : 'bg-[#F6F6F6] dark:bg-gray-900'
                    }`}
                  >
                    {/* Header da coluna */}
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <IconComponent size={18} className="text-gray-600 dark:text-gray-400" />
                      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate">
                        {stage.name}
                      </h3>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {stageLeads.length}
                      </Badge>
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
                               } cursor-pointer hover:shadow-md transition-all duration-200 min-h-[120px] ${
                                 snapshot.isDragging ? 'shadow-lg rotate-1 scale-105' : ''
                               }`}
                               onClick={() => navigate(`/lead/${lead.id}`)}
                             >
                               <CardHeader className="p-4">
                                 <div className="flex flex-col space-y-3">
                                   <div className="flex items-center gap-3">
                                     <Avatar className="h-12 w-12 flex-shrink-0">
                                        <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-base font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                                          {lead.leadName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                     <div className="flex-1 min-w-0">
                                       <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-2">
                                         {lead.opportunityName}
                                       </CardTitle>
                                       <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                         {lead.leadName}
                                       </p>
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
      <div className="grid grid-cols-4 gap-4 w-full">
        {stages.map((stage) => {
          const stageLeads = leads.filter(lead => lead.stage === stage.id);
          const IconComponent = stage.icon;

          return (
            <Droppable droppableId={stage.id} key={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-lg p-4 h-[600px] flex flex-col ${
                    snapshot.isDraggingOver ? 'bg-[#F6F6F6] dark:bg-gray-800' : 'bg-[#F6F6F6] dark:bg-gray-900'
                  }`}
                >
                  {/* Header da coluna */}
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <IconComponent size={16} className="text-gray-600 dark:text-gray-400" />
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                      {stage.name}
                    </h3>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {stageLeads.length}
                    </Badge>
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
                             } cursor-pointer hover:shadow-md transition-all duration-200 min-h-[100px] ${
                               snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : ''
                             }`}
                             onClick={() => navigate(`/lead/${lead.id}`)}
                           >
                             <CardHeader className="p-4">
                               <div className="flex flex-col space-y-3">
                                 <div className="flex items-center gap-3">
                                   <Avatar className="h-10 w-10 flex-shrink-0">
                                      <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                                        {lead.leadName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                   <div className="flex-1 min-w-0">
                                     <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                                       {lead.opportunityName}
                                     </CardTitle>
                                     <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                       {lead.leadName}
                                     </p>
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
