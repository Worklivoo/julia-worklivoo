import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Lead } from '@/types';

interface DeleteCardProps {
  lead: Lead;
  onDelete: () => Promise<void>;
}

export const DeleteCard: React.FC<DeleteCardProps> = ({ lead, onDelete }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card via-card to-card/95 border-border/50 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-foreground" />
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
                  onClick={handleDelete} 
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
  );
};