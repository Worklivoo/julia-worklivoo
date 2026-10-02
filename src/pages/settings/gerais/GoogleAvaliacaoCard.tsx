import React from 'react';
import { Star } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { GeraisCtx } from './useGerais';
import GeraisCard, { EditButton } from './GeraisCard';
import StatusTag from './StatusTag';

/** Permite que a IA envie o link de avaliação do Google quando o lead for qualificado. */
const GoogleAvaliacaoCard = ({ g }: { g: GeraisCtx }) => (
  <GeraisCard
    id="ger-google"
    icon={<Star aria-hidden="true" />}
    title="Google Avaliação"
    sub="Ative para permitir que a IA envie o link de avaliação do Google quando o lead for qualificado."
    action={
      <EditButton
        onClick={() => {
          g.setGoogleLinkAvaliacao(g.googleLinkAvaliacaoSalvo);
          g.setGoogleAvaliacaoPendingStatus(null);
          g.setGoogleAvaliacaoModalOpen(true);
        }}
      />
    }
  >
    {g.loadingGoogleAvaliacao ? (
      <p className="wl-clist__note">Carregando...</p>
    ) : (
      <div className="wl-subgrid">
        <div className="wl-set-box">
          <div className="wl-row">
            <div className="wl-kv">
              <span className="wl-label">Status</span>
              <StatusTag on={g.googleAvaliacaoAtiva} />
            </div>
            <Switch
              checked={g.googleAvaliacaoAtiva}
              onCheckedChange={g.handleToggleGoogleAvaliacao}
              disabled={g.isSavingGoogleAvaliacao}
              aria-label="Google Avaliação"
              className="data-[state=checked]:bg-[var(--ink)]"
            />
          </div>
        </div>
        <div className="wl-set-box">
          <div className="wl-kv">
            <span className="wl-label">Link do Google Avaliação</span>
            <span className="wl-kv__value wl-kv__value--text">{g.googleLinkAvaliacaoSalvo || '-'}</span>
          </div>
        </div>
      </div>
    )}
  </GeraisCard>
);

export default GoogleAvaliacaoCard;
