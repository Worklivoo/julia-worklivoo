import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, Check, X, Handshake } from 'lucide-react';
import { Lead } from '@/types';

interface NegotiationCardProps {
  lead: Lead;
  origins: string[];
  onSave: (data: Partial<Lead>) => void;
}

export const NegotiationCard: React.FC<NegotiationCardProps> = ({ lead, origins, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [editedData, setEditedData] = useState({
    opportunityName: lead.opportunityName,
    source: lead.source,
  });

  const handleSave = () => {
    onSave(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData({
      opportunityName: lead.opportunityName,
      source: lead.source,
    });
    setIsEditing(false);
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Handshake size={20} className="text-foreground" />
            Informações da Negociação
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted"
              >
                <Edit size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Editar informações da negociação</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nome da Oportunidade</label>
            {isEditing ? (
              <Input
                value={editedData.opportunityName}
                onChange={(e) => setEditedData(prev => ({ ...prev, opportunityName: e.target.value }))}
                className="mt-1 bg-background border-border"
              />
            ) : (
              <p className="text-foreground font-medium mt-1">{lead.opportunityName}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Data de Criação</label>
            <p className="mt-1">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Canal de Origem</label>
            {isEditing ? (
              <div className="relative">
                <Input
                  value={editedData.source}
                  onChange={(e) => setEditedData(prev => ({ ...prev, source: e.target.value }))}
                  className="mt-1 bg-background border-border"
                  placeholder="Digite ou selecione uma origem"
                  onFocus={() => setShowOriginSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 200)}
                />
                {showOriginSuggestions && origins.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {origins.map((origin, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setEditedData(prev => ({ ...prev, source: origin }))}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      >
                        {origin}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-1">{lead.source}</p>
            )}
          </div>
        </div>
        {isEditing && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleSave} 
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
                >
                  <Check size={16} className="mr-2" />
                  Salvar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Salvar alterações da negociação</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleCancel} 
                  className="border-border/50 hover:bg-muted/50"
                >
                  <X size={16} className="mr-2" />
                  Cancelar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cancelar edição</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
  );
};