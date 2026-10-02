import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useBaseConhecimento } from './conhecimento/useBaseConhecimento';
import PerguntaCard from './conhecimento/PerguntaCard';
import PerguntaDialog from './conhecimento/PerguntaDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';

/**
 * Aba "Base de Conhecimento" das Configurações: perguntas e respostas que a IA usa no atendimento.
 * Lógica em `conhecimento/useBaseConhecimento.ts`; cartão e diálogo de pergunta na mesma pasta.
 */
export const BaseConhecimentoTab: React.FC = () => {
  const k = useBaseConhecimento();

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <h3 className="wl-section__title">Base de Conhecimento</h3>
          <p className="wl-lede">Cadastre perguntas e respostas para a IA usar durante o atendimento.</p>
        </div>
        <div className="wl-qa__head">
          <span className="wl-tag wl-tag--plain">{k.count} {k.count === 1 ? 'pergunta' : 'perguntas'}</span>
          {k.isAdmin && (
            <button type="button" className="wl-btn wl-btn--lime wl-btn--sm" onClick={k.openCreate}>
              <Plus aria-hidden="true" width={15} height={15} />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {k.loading ? (
        <p className="wl-clist__note">Carregando...</p>
      ) : k.items.length === 0 ? (
        <div className="wl-empty">
          <span className="wl-empty__icon"><BookOpen aria-hidden="true" /></span>
          <p className="wl-empty__title">Nenhuma pergunta cadastrada ainda</p>
          <p className="wl-empty__text">As perguntas e respostas cadastradas aqui ficam disponíveis para a IA.</p>
        </div>
      ) : (
        <div className="wl-qa-list">
          {k.items.map((item) => (
            <PerguntaCard key={item.conhecimento_id} item={item} k={k} />
          ))}
        </div>
      )}

      <PerguntaDialog k={k} mode="create" />
      <PerguntaDialog k={k} mode="edit" />

      <AlertDialog open={k.deleteOpen} onOpenChange={k.setDeleteOpen}>
        <AlertDialogContent className="wl-scope wl-modal wl-modal--sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader className="wl-modal__head">
            <AlertDialogTitle className="wl-title wl-title--sm">Remover pergunta?</AlertDialogTitle>
            <AlertDialogDescription className="wl-lede">
              Essa ação remove a pergunta e resposta da sua base de conhecimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="wl-modal__foot wl-modal__foot--end">
            <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => k.setDeleteOpen(false)} disabled={k.saving}>
              Cancelar
            </button>
            <button type="button" className="wl-btn wl-btn--danger" onClick={k.handleDelete} disabled={k.saving}>
              {k.saving ? 'Removendo...' : 'Remover'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BaseConhecimentoTab;
