import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { getFeedbacksByUser } from '@/lib/supabase-utils';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

interface HistoricoOtimizacoesTabProps {
  settingsOwnerUserId: string | null;
}

/**
 * Aba "Histórico de Otimizações" das Configurações: lista os feedbacks negativos do usuário
 * e se a otimização correspondente já foi concluída.
 */
export const HistoricoOtimizacoesTab: React.FC<HistoricoOtimizacoesTabProps> = ({ settingsOwnerUserId }) => {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState<boolean>(false);

  useEffect(() => {
    const loadFeedbacks = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFeedbacks(true);
      const { data } = await getFeedbacksByUser(settingsOwnerUserId);
      const negatives = (data || []).filter((f: any) => String(f?.comentario_tipo || '').toLowerCase() === 'negativo');
      setFeedbacks(negatives);
      setLoadingFeedbacks(false);
    };
    loadFeedbacks();
  }, [settingsOwnerUserId]);

  const total = feedbacks.length;

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <h3 className="wl-section__title">Histórico de Otimizações</h3>
          <p className="wl-lede">Feedbacks negativos enviados nas conversas e o andamento de cada otimização.</p>
        </div>
        {!loadingFeedbacks && total > 0 && (
          <span className="wl-tag wl-tag--plain">{total} {total === 1 ? 'registro' : 'registros'}</span>
        )}
      </div>

      {loadingFeedbacks ? (
        <p className="wl-clist__note">Carregando...</p>
      ) : total === 0 ? (
        <div className="wl-empty">
          <span className="wl-empty__icon"><History aria-hidden="true" /></span>
          <p className="wl-empty__title">Nenhum registro encontrado</p>
          <p className="wl-empty__text">Os feedbacks negativos das conversas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="wl-tbl-wrap">
          <table className="wl-tbl wl-hist">
            <thead>
              <tr>
                <th>Data</th>
                <th>Feedback</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f) => {
                const concluida = f.status === true;
                return (
                  <tr key={String(f.feedback_id || `${f.user_id}-${f.mensagem_id}-${f.criado_em}`)}>
                    <td className="is-nowrap wl-hist__date" data-label="Data">{f.criado_em ? new Date(f.criado_em).toLocaleString('pt-BR') : '-'}</td>
                    <td className="is-wrap is-strong wl-hist__text" title={f.comentario_mensagem}>{f.comentario_mensagem || '-'}</td>
                    <td className="is-nowrap wl-hist__status">
                      <span className={`wl-tag ${concluida ? 'wl-tag--won' : 'wl-tag--idle'}`}>
                        {concluida ? 'Otimização concluída' : 'Em andamento'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HistoricoOtimizacoesTab;
