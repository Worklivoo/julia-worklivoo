import React from 'react';
import { Bell, Building2, CalendarClock, CheckCircle2, ChevronRight, RefreshCw, X } from 'lucide-react';
import type { TarefaAtrasada } from '@/types';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';
import '@/styles/worklivoo-shell.css';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tarefas: TarefaAtrasada[];
  loading: boolean;
  onNavigateToLead: (leadId: number) => void;
  onRefresh: () => void;
}

const parseTimestamp = (value: unknown): Date => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return new Date(0);
  const normalized = raw
    .replace(' ', 'T')
    .replace(/\+00:00$/, 'Z')
    .replace(/\+00$/, 'Z')
    .replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
};

const formatarAtraso = (dataString: string) => {
  const data = parseTimestamp(dataString);
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'Vencendo agora';
  if (diffMin < 60) return `${diffMin} min de atraso`;
  if (diffHoras < 24) return `${diffHoras} h de atraso`;
  return `${diffDias} dias de atraso`;
};

/** Painel lateral com as tarefas atrasadas do usuário (abre pelo sino do menu). */
const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  tarefas,
  loading,
  onNavigateToLead,
  onRefresh,
}) => {
  const resumo = loading
    ? 'Carregando...'
    : tarefas.length === 0
      ? 'Nenhuma tarefa pendente'
      : `${tarefas.length} ${tarefas.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`;

  return (
    <div className="wl-scope">
      <div className={`wl-notif__overlay${isOpen ? ' is-open' : ''}`} onClick={onClose} />

      <aside className={`wl-notif${isOpen ? ' is-open' : ''}`} aria-label="Notificações" aria-hidden={!isOpen}>
        <header className="wl-notif__head">
          <div className="wl-notif__id">
            <span className="wl-notif__bell">
              <Bell aria-hidden="true" />
              {tarefas.length > 0 && (
                <span className="wl-notif__count">{tarefas.length > 99 ? '99+' : tarefas.length}</span>
              )}
            </span>
            <div>
              <h2 className="wl-notif__title">Tarefas atrasadas</h2>
              <p className="wl-notif__sub">{resumo}</p>
            </div>
          </div>

          <div className="wl-notif__tools">
            <button type="button" className="wl-iconbtn" onClick={onRefresh} disabled={loading} aria-label="Atualizar tarefas">
              <RefreshCw className={loading ? 'wl-estoque__spin' : undefined} aria-hidden="true" />
            </button>
            <button type="button" className="wl-iconbtn" onClick={onClose} aria-label="Fechar notificações">
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        {loading && tarefas.length === 0 ? (
          <div className="wl-notif__empty" role="status">
            <span className="wl-spin wl-spin--lg" aria-hidden="true" />
            <p className="wl-empty__title">Buscando tarefas...</p>
            <p className="wl-empty__text">Aguarde um momento.</p>
          </div>
        ) : tarefas.length === 0 ? (
          <div className="wl-notif__empty">
            <span className="wl-empty__icon"><CheckCircle2 aria-hidden="true" /></span>
            <p className="wl-empty__title">Nenhuma tarefa atrasada</p>
            <p className="wl-empty__text">Excelente! Todas as suas tarefas estão em dia.</p>
          </div>
        ) : (
          <ul className="wl-notif__list">
            {tarefas.map((tarefa) => {
              const leadLabel =
                tarefa.lead_oportunidade?.trim() || tarefa.lead_nome?.trim() || `Lead #${tarefa.lead_id}`;

              return (
                <li key={tarefa.tarefa_id}>
                  <button type="button" className="wl-notif__item" onClick={() => onNavigateToLead(tarefa.lead_id)}>
                    <span className="wl-notif__ico"><CalendarClock aria-hidden="true" /></span>
                    <span className="wl-notif__body">
                      <span className="wl-notif__task">{tarefa.tarefa_titulo}</span>
                      <span className="wl-notif__meta">
                        <Building2 aria-hidden="true" />
                        <span>{leadLabel}</span>
                      </span>
                      <span className="wl-tag wl-tag--alert wl-notif__late">{formatarAtraso(tarefa.data_vencimento)}</span>
                    </span>
                    <ChevronRight className="wl-notif__arrow" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
};

export { NotificationPanel };
