import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle } from 'lucide-react';
import { Lead } from '@/types';

interface AdditionalInfoCardProps {
  lead: Lead;
}

export const AdditionalInfoCard: React.FC<AdditionalInfoCardProps> = ({ lead }) => {
  return (
    <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <CardTitle className="flex items-center gap-2">
          <FileText size={20} className="text-foreground" />
          Informações Adicionais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 mt-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText size={14} />
            Notas
          </label>
          <p className="text-foreground font-medium mt-1">
            {lead.lead_notas || 'Nenhuma nota disponível'}
          </p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText size={14} />
            ID da Conversa
          </label>
          <p className="text-foreground font-medium mt-1">
            {lead.thread_dify || 'Não informado'}
          </p>
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle size={14} />
            IA está Ativa?
          </label>
          <p className="text-foreground font-medium mt-1">
            {!lead.ativo_ia || lead.ativo_ia === '' ? 'Sim' : lead.ativo_ia === 'Não' ? 'Não' : 'Sim'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};