
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/contexts/CRMContext';
import { Lead } from '@/types';
import { Link } from 'react-router-dom';
import { Calendar, User, Phone } from 'lucide-react';

const stages = [
  { id: 'lead', name: 'Lead', color: 'bg-gray-500' },
  { id: 'qualified', name: 'Qualificado', color: 'bg-blue-500' },
  { id: 'proposal', name: 'Proposta', color: 'bg-yellow-500' },
  { id: 'negotiation', name: 'Negociação', color: 'bg-orange-500' },
  { id: 'closed-won', name: 'Fechado', color: 'bg-green-500' },
  { id: 'closed-lost', name: 'Perdido', color: 'bg-red-500' },
];

const KanbanBoard = () => {
  const { leads, updateLead } = useCRM();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedLead) {
      updateLead(draggedLead.id, { 
        stage: stageId as Lead['stage'],
        status: stageId === 'closed-won' ? 'won' : stageId === 'closed-lost' ? 'lost' : 'active'
      });
      setDraggedLead(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-6">
      {stages.map((stage) => {
        const stageLeads = leads.filter(lead => lead.stage === stage.id);
        const stageValue = stageLeads.reduce((sum, lead) => sum + lead.value, 0);

        return (
          <div
            key={stage.id}
            className="min-w-[300px] flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                  {stage.name}
                </h3>
                <Badge variant="secondary" className="bg-muted">
                  {stageLeads.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(stageValue)}
              </p>
            </div>

            <div className="space-y-3 min-h-[400px]">
              {stageLeads.map((lead) => (
                <Card
                  key={lead.id}
                  className="bg-card border-border cursor-move hover:shadow-lg transition-shadow"
                  draggable
                  onDragStart={() => handleDragStart(lead)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium text-primary">
                        {lead.opportunityName}
                      </CardTitle>
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(lead.priority)}`}></div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User size={12} />
                        <span>{lead.leadName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone size={12} />
                        <span>{lead.phone}</span>
                      </div>
                      {lead.expectedCloseDate && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar size={12} />
                          <span>{new Date(lead.expectedCloseDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-400">
                        {formatCurrency(lead.value)}
                      </span>
                      <Link to={`/lead/${lead.id}`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          Ver detalhes
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
