
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCRM } from '@/contexts/CRMContext';
import Header from '@/components/Header';
import { ArrowLeft, Calendar, Mail, Phone, User, Edit, Check, X, Plus } from 'lucide-react';

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, updateLead, addNote } = useCRM();
  const [isEditing, setIsEditing] = useState(false);
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [newNote, setNewNote] = useState('');

  const lead = leads.find(l => l.id === id);
  const [editedLead, setEditedLead] = useState(lead);

  if (!lead) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary mb-4">Lead não encontrado</h1>
            <Button onClick={() => navigate('/pipeline')}>
              Voltar ao Pipeline
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stages = [
    { id: 'lead', name: 'Lead', step: 1 },
    { id: 'qualified', name: 'Qualificado', step: 2 },
    { id: 'proposal', name: 'Proposta', step: 3 },
    { id: 'negotiation', name: 'Negociação', step: 4 },
    { id: 'closed-won', name: 'Fechado', step: 5 },
  ];

  const currentStageIndex = stages.findIndex(stage => stage.id === lead.stage);
  const progressPercentage = currentStageIndex >= 0 ? ((currentStageIndex + 1) / stages.length) * 100 : 0;

  const handleSave = () => {
    if (editedLead) {
      updateLead(id!, editedLead);
      setIsEditing(false);
    }
  };

  const handleMarkAsWon = () => {
    updateLead(id!, { status: 'won', stage: 'closed-won' });
  };

  const handleMarkAsLost = () => {
    if (lossReason.trim()) {
      updateLead(id!, { status: 'lost', stage: 'closed-lost', lossReason });
      setShowLossDialog(false);
      setLossReason('');
    }
  };

  const handleStageChange = (newStage: string) => {
    updateLead(id!, { stage: newStage as any });
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNote(id!, newNote);
      setNewNote('');
      setShowNoteDialog(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/pipeline')}
              className="border-border hover:bg-accent"
            >
              <ArrowLeft size={16} className="mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-primary">{lead.opportunityName}</h1>
              <p className="text-muted-foreground mt-1">
                Criado em {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lead.status === 'active' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                  className="border-border hover:bg-accent"
                >
                  <Edit size={16} className="mr-2" />
                  {isEditing ? 'Cancelar' : 'Editar'}
                </Button>
                <Button
                  onClick={handleMarkAsWon}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check size={16} className="mr-2" />
                  Marcar como Venda
                </Button>
                <Dialog open={showLossDialog} onOpenChange={setShowLossDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <X size={16} className="mr-2" />
                      Marcar como Perda
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Marcar como Perda</DialogTitle>
                      <DialogDescription>
                        Informe o motivo da perda desta oportunidade
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Descreva o motivo da perda..."
                        value={lossReason}
                        onChange={(e) => setLossReason(e.target.value)}
                        className="bg-background border-border"
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleMarkAsLost} variant="destructive">
                          Confirmar Perda
                        </Button>
                        <Button variant="outline" onClick={() => setShowLossDialog(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {isEditing && (
              <Button onClick={handleSave} className="bg-primary text-primary-foreground">
                Salvar Alterações
              </Button>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={lead.status === 'won' ? 'default' : lead.status === 'lost' ? 'destructive' : 'secondary'}
            className="text-sm px-3 py-1"
          >
            {lead.status === 'won' ? 'Venda Ganha' : lead.status === 'lost' ? 'Venda Perdida' : 'Ativo'}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {formatCurrency(lead.value)}
          </Badge>
          <Badge 
            variant={lead.priority === 'high' ? 'destructive' : lead.priority === 'medium' ? 'default' : 'secondary'}
            className="text-sm px-3 py-1"
          >
            Prioridade: {lead.priority === 'high' ? 'Alta' : lead.priority === 'medium' ? 'Média' : 'Baixa'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Negociação */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Informações da Negociação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nome da Oportunidade</label>
                    {isEditing ? (
                      <Input
                        value={editedLead?.opportunityName || ''}
                        onChange={(e) => setEditedLead(prev => prev ? {...prev, opportunityName: e.target.value} : null)}
                        className="mt-1 bg-background border-border"
                      />
                    ) : (
                      <p className="text-primary font-medium mt-1">{lead.opportunityName}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Valor</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedLead?.value || 0}
                        onChange={(e) => setEditedLead(prev => prev ? {...prev, value: Number(e.target.value)} : null)}
                        className="mt-1 bg-background border-border"
                      />
                    ) : (
                      <p className="text-green-400 font-semibold mt-1">{formatCurrency(lead.value)}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data de Criação</label>
                    <p className="mt-1">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Canal de Origem</label>
                    {isEditing ? (
                      <Input
                        value={editedLead?.source || ''}
                        onChange={(e) => setEditedLead(prev => prev ? {...prev, source: e.target.value} : null)}
                        className="mt-1 bg-background border-border"
                      />
                    ) : (
                      <p className="mt-1">{lead.source}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Barra de Progresso das Etapas */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Progresso da Oportunidade</CardTitle>
                <CardDescription>
                  Acompanhe o progresso através das etapas do pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={progressPercentage} className="h-3" />
                  <div className="flex justify-between items-center">
                    {stages.map((stage, index) => (
                      <div key={stage.id} className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium cursor-pointer transition-colors ${
                            index <= currentStageIndex
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          onClick={() => lead.status === 'active' && handleStageChange(stage.id)}
                        >
                          {stage.step}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 text-center">
                          {stage.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Anotações */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Anotações</CardTitle>
                  <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-primary text-primary-foreground">
                        <Plus size={16} className="mr-2" />
                        Nova Anotação
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle>Adicionar Anotação</DialogTitle>
                        <DialogDescription>
                          Adicione uma nova anotação para este lead
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Digite sua anotação..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="bg-background border-border"
                          rows={4}
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleAddNote}>
                            Salvar Anotação
                          </Button>
                          <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lead.notes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma anotação adicionada ainda.
                    </p>
                  ) : (
                    lead.notes
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((note) => (
                        <div key={note.id} className="p-4 border border-border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-primary">{note.author}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{note.content}</p>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações de Contato */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Informações de Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User size={14} />
                    Nome do Lead
                  </label>
                  {isEditing ? (
                    <Input
                      value={editedLead?.leadName || ''}
                      onChange={(e) => setEditedLead(prev => prev ? {...prev, leadName: e.target.value} : null)}
                      className="mt-1 bg-background border-border"
                    />
                  ) : (
                    <p className="text-primary font-medium mt-1">{lead.leadName}</p>
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
                      value={editedLead?.email || ''}
                      onChange={(e) => setEditedLead(prev => prev ? {...prev, email: e.target.value} : null)}
                      className="mt-1 bg-background border-border"
                    />
                  ) : (
                    <p className="mt-1">
                      <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
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
                      value={editedLead?.phone || ''}
                      onChange={(e) => setEditedLead(prev => prev ? {...prev, phone: e.target.value} : null)}
                      className="mt-1 bg-background border-border"
                    />
                  ) : (
                    <p className="mt-1">
                      <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                        {lead.phone}
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
                    <p className="mt-1">{new Date(lead.expectedCloseDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Motivo da Perda (se aplicável) */}
            {lead.status === 'lost' && lead.lossReason && (
              <Card className="bg-card border-border border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-400">Motivo da Perda</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{lead.lossReason}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
