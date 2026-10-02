import React from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useEstoque } from './estoque/useEstoque';
import { formatTimestamp } from './estoque/helpers';
import EstoqueTabela from './estoque/EstoqueTabela';
import ProdutoFormDialog from './estoque/ProdutoFormDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';

/**
 * Aba "Estoque de Produtos" das Configurações (Loja de Carros ou Imobiliária).
 * Lógica em `estoque/useEstoque.ts`; tabela, formulário e colunas na mesma pasta.
 */
export const EstoqueTab: React.FC = () => {
  const e = useEstoque();
  const naoSuportado = !e.isSupportedTipo && !e.isTipoOutros;

  const placeholderBusca =
    !e.isSupportedTipo || e.isTipoOutros
      ? 'Buscar...'
      : e.estoqueKind === 'carro'
        ? 'Buscar por marca, modelo, ano, combustível, cor, preço, descrição ou itens extras...'
        : 'Buscar por título, transação, propriedade, endereço, valores, descrição ou itens extras...';

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <div className="wl-estoque__title">
            <h3 className="wl-section__title">Estoque de Produtos</h3>
            <span className="wl-tag wl-tag--plain">{e.userTipo || '-'}</span>
          </div>
          <p className="wl-lede">
            {naoSuportado
              ? 'Disponível apenas para Loja de Carros ou Imobiliária.'
              : 'Produtos que a IA pode oferecer durante o atendimento.'}
          </p>
        </div>

        {!naoSuportado && e.shouldShowSyncButton ? (
          <button
            type="button"
            className="wl-btn wl-btn--glass wl-btn--sm"
            onClick={e.handleSyncNow}
            disabled={e.isSyncing}
            title="Sincronizar agora"
          >
            <RefreshCw className={e.isSyncing ? 'wl-estoque__spin' : undefined} aria-hidden="true" width={15} height={15} />
            Sincronizar agora
          </button>
        ) : null}
      </div>

      <p className="wl-estoque__stats">
        <span>Total: <strong>{e.stats.total}</strong></span>
        <span aria-hidden="true">•</span>
        <span>Última atualização: <strong>{formatTimestamp(e.stats.lastUpdated ?? null)}</strong></span>
      </p>

      {e.isSyncing ? (
        <div className="wl-empty" role="status">
          <span className="wl-empty__icon"><RefreshCw className="wl-estoque__spin" aria-hidden="true" /></span>
          <p className="wl-empty__title">Sincronizando estoque...</p>
          <p className="wl-empty__text">Aguarde até 5 minutos.</p>
        </div>
      ) : (
        <>
          <div className="wl-estoque__bar">
            <input
              className="wl-input"
              type="search"
              value={e.search}
              onChange={(ev) => e.setSearch(ev.target.value)}
              placeholder={placeholderBusca}
              aria-label="Buscar no estoque"
              disabled={!e.isSupportedTipo}
            />
            {e.canManageItems ? (
              <div className="wl-estoque__actions">
                <button
                  type="button"
                  className="wl-btn wl-btn--glass wl-btn--sm"
                  onClick={() => e.setAddOpen(true)}
                  disabled={!e.isSupportedTipo || e.isSyncing}
                >
                  <Plus aria-hidden="true" width={15} height={15} />
                  Adicionar
                </button>
                <button
                  type="button"
                  className="wl-btn wl-btn--danger wl-btn--sm"
                  disabled={e.selectedCount === 0}
                  onClick={() => e.setDeleteOpen(true)}
                >
                  <Trash2 aria-hidden="true" width={15} height={15} />
                  Excluir
                </button>
              </div>
            ) : null}
          </div>

          {e.isSupportedTipo && <EstoqueTabela e={e} />}

          {e.canManageItems ? (
            <>
              <AlertDialog open={e.deleteOpen} onOpenChange={e.setDeleteOpen}>
                <AlertDialogContent className="wl-scope wl-modal wl-modal--sm" onOpenAutoFocus={(ev) => ev.preventDefault()}>
                  <AlertDialogHeader className="wl-modal__head">
                    <AlertDialogTitle className="wl-title wl-title--sm">Excluir itens selecionados?</AlertDialogTitle>
                    <AlertDialogDescription className="wl-lede" asChild>
                      <div>
                        <p className="wl-confirm__warn" style={{ marginTop: 0 }}>Esta ação não pode ser desfeita.</p>
                        <p>Itens selecionados: <strong>{e.selectedCount}</strong></p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="wl-modal__foot wl-modal__foot--end">
                    <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => e.setDeleteOpen(false)} disabled={e.deleting}>
                      Cancelar
                    </button>
                    <button type="button" className="wl-btn wl-btn--danger" onClick={e.handleConfirmDeleteSelected} disabled={e.deleting}>
                      {e.deleting ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </AlertDialogContent>
              </AlertDialog>

              <ProdutoFormDialog e={e} mode="edit" />
              <ProdutoFormDialog e={e} mode="add" />
            </>
          ) : null}
        </>
      )}
    </div>
  );
};

export default EstoqueTab;
