import React from 'react';
import {
  X,
  Bell,
  CalendarClock,
  Building2,
  ChevronRight
} from 'lucide-react';
import type { TarefaAtrasada } from '@/types';

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

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  tarefas,
  loading,
  onNavigateToLead,
  onRefresh
}) => {
  return (
    <>
      <div
        className={`notifications-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />

      <aside className={`notification-panel ${isOpen ? 'open' : ''}`}>
        <header className="notification-panel-header">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#EBF57D] flex items-center justify-center text-black relative">
              <Bell size={20} />
              {tarefas.length > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                  {tarefas.length > 99 ? '99+' : tarefas.length}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-black leading-tight">
                Tarefas Atrasadas
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading
                  ? 'Carregando...'
                  : tarefas.length === 0
                  ? 'Nenhuma tarefa pendente'
                  : `${tarefas.length} ${tarefas.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              aria-label="Atualizar tarefas"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 1-15.2 6.4L3 16" />
                <path d="M3 12a9 9 0 0 1 15.2-6.4L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M3 21v-5h5" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Fechar notificações"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="notification-panel-list">
          {loading && tarefas.length === 0 ? (
            <div className="notification-empty">
              <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-gray-300 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 1-15.2 6.4L3 16" />
                  <path d="M3 12a9 9 0 0 1 15.2-6.4L21 8" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">Buscando tarefas...</p>
              <p className="text-xs text-gray-400 mt-1">Aguarde um momento.</p>
            </div>
          ) : tarefas.length === 0 ? (
            <div className="notification-empty">
              <div className="h-16 w-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                Nenhuma tarefa atrasada
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Excelente! Todas as suas tarefas estão em dia.
              </p>
            </div>
          ) : (
            <ul className="notification-list">
              {tarefas.map((tarefa) => {
                const leadLabel =
                  tarefa.lead_oportunidade?.trim() ||
                  tarefa.lead_nome?.trim() ||
                  `Lead #${tarefa.lead_id}`;

                return (
                  <li
                    key={tarefa.tarefa_id}
                    className="notification-item unread cursor-pointer group"
                    onClick={() => onNavigateToLead(tarefa.lead_id)}
                  >
                    <div className="notification-icon bg-red-100 text-red-600">
                      <CalendarClock size={16} />
                    </div>

                    <div className="notification-content">
                      <div className="notification-top">
                        <h3 className="notification-title">{tarefa.tarefa_titulo}</h3>
                        <span className="notification-date font-medium text-red-500 whitespace-nowrap">
                          {formatarAtraso(tarefa.data_vencimento)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[12px] text-gray-600 mt-1">
                        <Building2 size={12} className="flex-shrink-0 text-gray-400" />
                        <span className="font-medium truncate max-w-[220px]">
                          {leadLabel}
                        </span>
                      </div>
                    </div>

                    <div className="notification-item-actions">
                      <div className="notification-dot bg-red-500" />
                      <ChevronRight
                        size={15}
                        className="text-gray-300 group-hover:text-gray-500 transition-colors"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
};

export { NotificationPanel };
