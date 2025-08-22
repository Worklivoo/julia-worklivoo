import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCRM } from '@/contexts/CRMContext';
import { useLeadOrigins } from '@/hooks/use-lead-origins';
import { Note } from '@/types';
import { ArrowLeft, Calendar, Mail, Phone, User, Edit, Check, X, Plus, UserPlus, PhoneCall, FileText, Handshake, CheckCircle, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, updateLead, addNote, getNotesByLead, deleteLead } = useCRM();
  const { origins } = useLeadOrigins();
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isEditingNegotiation, setIsEditingNegotiation] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const lead = leads.find(l => l.id === id);
  const [editedLead, setEditedLead] = useState(lead);

  // Carregar anotações do lead quando o componente montar
  useEffect(() => {
    const loadNotes = async () => {
      if (!id) return;
      
      setIsLoadingNotes(true);
      try {
        const leadNotes = await getNotesByLead(id);
        setNotes(leadNotes);
      } catch (error) {
        console.error('Erro ao carregar anotações:', error);
      } finally {
        setIsLoadingNotes(false);
      }
    };

    loadNotes();
  }, [id, getNotesByLead]);

  if (!lead) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-4 light-title">Lead não encontrado</h1>
        <Button onClick={() => navigate('/leads')}>
          Voltar ao Pipeline
        </Button>
      </div>
    );
  }

  const stages = [
    { id: 'entrada', name: 'Entrada do Lead', icon: UserPlus },
    { id: 'tentando-contato', name: 'Tentando Contato', icon: PhoneCall },
    { id: 'contato-realizado', name: 'Contato Realizado', icon: Check },
    { id: 'qualificada', name: 'Oportunidade Qualificada', icon: Handshake },
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
    updateLead(id!, { status: 'won' });
  };

  const handleMarkAsLost = () => {
    updateLead(id!, { status: 'lost' });
  };

  const handleStageChange = (newStage: string) => {
    updateLead(id!, { stage: newStage as any });
  };

  const handleAddNote = async () => {
    if (newNote.trim() && id) {
      setIsAddingNote(true);
      try {
        const success = await addNote(id, newNote.trim());
        if (success) {
          setNewNote('');
          setShowNoteDialog(false);
          // Recarregar anotações para mostrar a nova
          const updatedNotes = await getNotesByLead(id);
          setNotes(updatedNotes);
        } else {
          alert('Erro ao adicionar anotação. Tente novamente.');
        }
      } catch (error) {
        console.error('Erro ao adicionar anotação:', error);
        alert('Erro ao adicionar anotação. Tente novamente.');
      } finally {
        setIsAddingNote(false);
      }
    }
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

  const handleSaveNegotiation = () => {
    if (editedLead) {
      updateLead(id!, {
        opportunityName: editedLead.opportunityName,
        source: editedLead.source,
      });
      setIsEditingNegotiation(false);
    }
  };

  const handleSaveContact = () => {
    if (editedLead) {
      updateLead(id!, {
        leadName: editedLead.leadName,
        email: editedLead.email,
        phone: editedLead.phone,
        expectedCloseDate: editedLead.expectedCloseDate,
      });
      setIsEditingContact(false);
    }
  };

  const handleResumeNegotiation = () => {
    updateLead(id!, { status: 'active' });
  };

  const handleDeleteLead = async () => {
    if (!id) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteLead(id);
      if (success) {
        setShowDeleteDialog(false);
        navigate('/leads');
      } else {
        alert('Erro ao excluir lead. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
      alert('Erro ao excluir lead. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Formata o telefone para o padrão +55 99 99999-9999
  function formatPhone(phone: string) {
    if (!phone) return '';
    // Remove tudo que não for número
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      // +55 99 99999-9999
      return `+${cleaned.slice(0,2)} ${cleaned.slice(2,4)} ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
    }
    return phone;
  }

  // Verifica se uma anotação é longa o suficiente para precisar de expansão
  const isNoteLong = (content: string) => {
    return content.length > 200; // Limite de 200 caracteres
  };

  // Alterna a expansão de uma anotação
  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  // Trunca o texto da anotação se não estiver expandida
  const getTruncatedContent = (content: string, noteId: string) => {
    const isExpanded = expandedNotes.has(noteId);
    if (!isNoteLong(content) || isExpanded) {
      return content;
    }
    return content.substring(0, 200) + '...';
  };

  // Barra de etapas minimalista
  function StepProgressBar({ stages, currentStageIndex }: { stages: any[]; currentStageIndex: number }) {
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
                        onClick={() => lead.status === 'active' && handleStageChange(stage.id)}
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
  }

  return (
    <div className="space-y-6">
      {/* Header com gradiente e avatar */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-100/90 via-white to-slate-100/90 p-6 border border-border/50 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5"></div>
        
        {isMobile ? (
          // Layout Mobile - Botões abaixo dos títulos
          <div className="relative space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                  {lead.leadName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-800">{lead.opportunityName}</h1>
                <p className="text-sm text-muted-foreground mt-1">{lead.leadName}</p>
              </div>
            </div>
            
            {/* Botões em layout mobile */}
            <div className="flex flex-col gap-3">
              {lead.status === 'active' && (
                <div className="flex gap-2">
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button
                         onClick={handleMarkAsWon}
                         size="sm"
                         className="flex-1 h-8 px-2 text-xs bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
                       >
                         <Check size={12} className="mr-1" />
                         Venda
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>Marcar esta oportunidade como venda realizada</p>
                     </TooltipContent>
                   </Tooltip>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button 
                         onClick={handleMarkAsLost}
                         size="sm"
                         className="flex-1 h-8 px-2 text-xs bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
                       >
                         <X size={12} className="mr-1" />
                         Perda
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>Marcar esta oportunidade como perdida</p>
                     </TooltipContent>
                   </Tooltip>
                 </div>
              )}
              {(lead.status === 'won' || lead.status === 'lost') && (
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button 
                       onClick={handleResumeNegotiation} 
                       size="sm"
                       className="w-full h-8 px-2 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg"
                     >
                       Retomar Negociação
                     </Button>
                   </TooltipTrigger>
                   <TooltipContent>
                     <p>Reativar esta oportunidade para negociação</p>
                   </TooltipContent>
                 </Tooltip>
               )}
            </div>
          </div>
        ) : (
          // Layout Desktop - Botões ao lado
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                  {lead.leadName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-800">{lead.opportunityName}</h1>
                <p className="text-sm text-muted-foreground mt-1">{lead.leadName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lead.status === 'active' && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleMarkAsWon}
                        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
                      >
                        <Check size={16} className="mr-2" />
                        Marcar como Venda
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Marcar esta oportunidade como venda realizada</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleMarkAsLost}
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg"
                      >
                        <X size={16} className="mr-2" />
                        Marcar como Perda
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Marcar esta oportunidade como perdida</p>
                    </TooltipContent>
                  </Tooltip>
              </>
            )}
              {(lead.status === 'won' || lead.status === 'lost') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleResumeNegotiation} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg">
                      Retomar Negociação
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reativar esta oportunidade para negociação</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="w-full">
          <StepProgressBar stages={stages} currentStageIndex={currentStageIndex} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Handshake size={20} className="text-foreground" />
                  Informações da Negociação
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setIsEditingNegotiation((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted">
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
                  {isEditingNegotiation ? (
                    <Input
                      value={editedLead?.opportunityName || ''}
                      onChange={(e) => setEditedLead(prev => prev ? {...prev, opportunityName: e.target.value} : null)}
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
                    {isEditingNegotiation ? (
                      <div className="relative">
                        <Input
                          value={editedLead?.source || ''}
                          onChange={(e) => setEditedLead(prev => prev ? {...prev, source: e.target.value} : null)}
                          className="mt-1 bg-background border-border"
                          placeholder="Digite ou selecione uma origem"
                          onFocus={() => setShowOriginSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 200)}
                        />
                        {showOriginSuggestions && origins.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-40 overflow-y-auto" style={{maxHeight: '160px', minWidth: '100%'}}>
                            {origins.map((origin, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setEditedLead(prev => prev ? {...prev, source: origin} : null)}
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                              >
                                {origin}
                              </button>
                            ))}
                          </div>
                        )}
                        {showOriginSuggestions && origins.length > 0 && (
                          <div style={{height: '48px'}}></div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1">{lead.source}</p>
                    )}
                </div>
              </div>
              {isEditingNegotiation && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleSaveNegotiation} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg">
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
                      <Button variant="outline" onClick={() => { setIsEditingNegotiation(false); setEditedLead(lead); }} className="border-border/50 hover:bg-muted/50">
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

          <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User size={20} className="text-foreground" />
                  Informações de Contato
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setIsEditingContact((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted">
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
                {isEditingContact ? (
                  <Input
                    value={editedLead?.leadName || ''}
                    onChange={(e) => setEditedLead(prev => prev ? {...prev, leadName: e.target.value} : null)}
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
                {isEditingContact ? (
                  <Input
                    type="email"
                    value={editedLead?.email || ''}
                    onChange={(e) => setEditedLead(prev => prev ? {...prev, email: e.target.value} : null)}
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
                {isEditingContact ? (
                  <Input
                    value={editedLead?.phone || ''}
                    onChange={(e) => setEditedLead(prev => prev ? {...prev, phone: e.target.value} : null)}
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
                  {isEditingContact ? (
                    <Input
                      type="date"
                      value={editedLead?.expectedCloseDate ? new Date(editedLead.expectedCloseDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditedLead(prev => prev ? {...prev, expectedCloseDate: new Date(e.target.value)} : null)}
                      className="mt-1 bg-background border-border"
                    />
                  ) : (
                    <p className="mt-1">{new Date(lead.expectedCloseDate).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              )}
              {isEditingContact && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleSaveContact} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg">
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
                      <Button variant="outline" onClick={() => { setIsEditingContact(false); setEditedLead(lead); }} className="border-border/50 hover:bg-muted/50">
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
                <p className="text-foreground font-medium mt-1">{lead.lead_notas || 'Nenhuma nota disponível'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText size={14} />
                  ID da Conversa
                </label>
                <p className="text-foreground font-medium mt-1">{lead.thread_dify || 'Não informado'}</p>
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

          {/* Seção de Exclusão de Lead */}
          <Card className="bg-gradient-to-br from-red-50 via-red-50/50 to-red-100/30 border-red-200/50 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-red-100/50 via-transparent to-red-100/50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={20} className="text-red-600" />
                Zona de Risco
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 mt-4">
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="bg-red-600 hover:bg-red-700 text-white shadow-lg"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Excluir Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                      <AlertTriangle size={20} />
                      Confirmar Exclusão
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-red-600">
                      Tem certeza que deseja excluir o lead <strong>{lead.leadName}</strong>?
                    </p>
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={handleDeleteLead} 
                        disabled={isDeleting}
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700 text-white shadow-lg disabled:opacity-50"
                      >
                        <Trash2 size={16} className="mr-2" />
                        {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowDeleteDialog(false)} 
                        disabled={isDeleting}
                        className="border-border/50 hover:bg-muted/50 disabled:opacity-50"
                      >
                        <X size={16} className="mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

        </div>
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText size={20} className="text-foreground" />
                  Anotações
                  <Badge variant="secondary" className="ml-2">
                    {notes.length}
                  </Badge>
                </CardTitle>
                <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      className="shadow-lg" 
                      style={{backgroundColor: '#EBF57D', color: '#000000'}} 
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#D4E157'} 
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}
                    >
                      <Plus size={16} className="mr-2" />
                      Nova Anotação
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={`bg-card border-border ${isMobile ? 'w-[95vw] h-[90vh] max-w-none' : 'w-[60vw] h-[75vh] max-w-none'} min-h-0`}>
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
                        className={`bg-background border-border ${isMobile ? 'h-[60vh]' : 'h-[45vh]'}`}
                        rows={isMobile ? 20 : 16}
                      />
                      <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
                        <Button 
                          onClick={handleAddNote} 
                          disabled={isAddingNote} 
                          className={`bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg disabled:opacity-50 ${isMobile ? 'w-full' : ''}`}
                        >
                          <Check size={16} className="mr-2" />
                          {isAddingNote ? 'Salvando...' : 'Salvar Anotação'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowNoteDialog(false)} 
                          disabled={isAddingNote} 
                          className={`border-border/50 hover:bg-muted/50 disabled:opacity-50 ${isMobile ? 'w-full' : ''}`}
                        >
                          <X size={16} className="mr-2" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="mt-4">
              <div className="space-y-4">
                {isLoadingNotes ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-muted-foreground">Carregando anotações...</p>
                  </div>
                ) : notes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma anotação adicionada ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((note, index) => (
                        <div key={note.id}>
                          <div className="p-4 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border border-border/50 rounded-lg hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{note.author}</span>
                              </div>
                              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                {formatDate(note.createdAt)}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm whitespace-pre-line">
                                {getTruncatedContent(note.content, note.id)}
                              </p>
                              {isNoteLong(note.content) && (
                                <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => toggleNoteExpansion(note.id)}
                                   className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
                                 >
                                  {expandedNotes.has(note.id) ? (
                                    <>
                                      <ChevronUp size={14} className="mr-1" />
                                      Recolher
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} className="mr-1" />
                                      Expandir
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          {index < notes.length - 1 && <Separator className="my-3" />}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
