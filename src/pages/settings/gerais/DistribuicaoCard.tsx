import React from 'react';
import { Shuffle } from 'lucide-react';
import { formatPhone } from '@/lib/lead-detail-utils';
import type { GeraisCtx } from './useGerais';
import GeraisCard, { EditButton } from './GeraisCard';

/** Como os leads são direcionados para qualificação (WhatsApp ou Roleta) e quais números recebem. */
const DistribuicaoCard = ({ g }: { g: GeraisCtx }) => {
  const modo = String(g.modoQualificacao || '').toLowerCase();
  const numeros =
    modo === 'roleta' || modo === 'whatsapp'
      ? (g.telefoneQualificado || '').split(',').map((n) => n.trim()).filter(Boolean)
      : g.telefoneQualificado
        ? [g.telefoneQualificado]
        : [];

  return (
    <GeraisCard
      id="ger-distribuicao"
      icon={<Shuffle aria-hidden="true" />}
      title="Distribuição de Leads"
      sub="Defina como os leads serão direcionados para qualificação"
      action={<EditButton onClick={() => g.setReceiveMethodModalOpen(true)} />}
    >
      {g.telefoneQualificado ? (
        <div className="wl-set-box">
          <div className="wl-kv">
            <span className="wl-label">Configuração atual</span>
            <span className="wl-kv__value">{g.modoQualificacao || 'Whatsapp'}</span>
          </div>
          <div className="wl-pillrow">
            {numeros.map((n) => (
              <span key={n} className="wl-tag wl-tag--plain">{formatPhone(n)}</span>
            ))}
          </div>
        </div>
      ) : (
        <p className="wl-set-box wl-kv__value wl-kv__value--text">Nenhuma configuração salva.</p>
      )}
    </GeraisCard>
  );
};

export default DistribuicaoCard;
