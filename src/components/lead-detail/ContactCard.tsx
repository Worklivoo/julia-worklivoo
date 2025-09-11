import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, Check, X, User, Mail, Phone, Calendar } from 'lucide-react';
import { Lead } from '@/types';

interface ContactCardProps {
  lead: Lead;
  onSave: (data: Partial<Lead>) => void;
}

// Formata o telefone para o padrão +55 99 99999-9999
function formatPhone(phone: string) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0,2)} ${cleaned.slice(2,4)} ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

export const ContactCard: React.FC<ContactCardProps> = ({ lead, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    leadName: lead.leadName,
    email: lead.email,
    phone: lead.phone,
    expectedCloseDate: lead.expectedCloseDate,
  });

  const handleSave = () => {
    onSave(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData({
      leadName: lead.leadName,
      email: lead.email,
      phone: lead.phone,
      expectedCloseDate: lead.expectedCloseDate,
    });
    setIsEditing(false);
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User size={20} className="text-foreground" />
            Informações de Contato
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
              <p>Editar informações de contato</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 mt-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User size={14} />
            Nome do Lead
          </label>
          {isEditing ? (
            <Input
              value={editedData.leadName}
              onChange={(e) => setEditedData(prev => ({ ...prev, leadName: e.target.value }))}
              className="mt-1 bg-background border-border"
            />
          ) : (
            <p className="text-foreground font-medium mt-1">{lead.leadName}</p>
          )}
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Mail size={14} />
            E-mail
          </label>
          {isEditing ? (
            <Input
              type="email"
              value={editedData.email}
              onChange={(e) => setEditedData(prev => ({ ...prev, email: e.target.value }))}
              className="mt-1 bg-background border-border"
            />
          ) : (
            <p className="mt-1">
              <a href={`mailto:${lead.email}`} className="text-foreground hover:underline">
                {lead.email}
              </a>
            </p>
          )}
        </div>
        
        <div>
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Phone size={14} />
            Telefone
          </label>
          {isEditing ? (
            <Input
              value={editedData.phone}
              onChange={(e) => setEditedData(prev => ({ ...prev, phone: e.target.value }))}
              className="mt-1 bg-background border-border"
            />
          ) : (
            <p className="mt-1">
              <a href={`tel:${lead.phone}`} className="text-foreground hover:underline">
                {formatPhone(lead.phone)}
              </a>
            </p>
          )}
        </div>
        
        {lead.expectedCloseDate && (
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar size={14} />
              Data Esperada de Fechamento
            </label>
            {isEditing ? (
              <Input
                type="date"
                value={editedData.expectedCloseDate ? new Date(editedData.expectedCloseDate).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditedData(prev => ({ ...prev, expectedCloseDate: new Date(e.target.value) }))}
                className="mt-1 bg-background border-border"
              />
            ) : (
              <p className="mt-1">{new Date(lead.expectedCloseDate).toLocaleDateString('pt-BR')}</p>
            )}
          </div>
        )}
        
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
                <p>Salvar alterações de contato</p>
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