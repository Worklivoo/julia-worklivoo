import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Note } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotesCardProps {
  notes: Note[];
  isLoadingNotes: boolean;
  onAddNote: (content: string) => Promise<void>;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isNoteLong(content: string) {
  return content.length > 200;
}

export const NotesCard: React.FC<NotesCardProps> = React.memo(({ notes, isLoadingNotes, onAddNote }) => {
  const isMobile = useIsMobile();
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const handleAddNote = useCallback(async () => {
    if (newNote.trim()) {
      setIsAddingNote(true);
      try {
        await onAddNote(newNote.trim());
        setNewNote('');
        setShowNoteDialog(false);
      } catch (error) {
        console.error('Erro ao adicionar anotação:', error);
      } finally {
        setIsAddingNote(false);
      }
    }
  }, [newNote, onAddNote]);

  const toggleNoteExpansion = useCallback((noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  }, []);

  const getTruncatedContent = (content: string, noteId: string) => {
    const isExpanded = expandedNotes.has(noteId);
    if (!isNoteLong(content) || isExpanded) {
      return content;
    }
    return content.substring(0, 200) + '...';
  };

  return (
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
  );
});

NotesCard.displayName = 'NotesCard';