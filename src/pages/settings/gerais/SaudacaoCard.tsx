import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { GeraisCtx } from './useGerais';
import { renderSaudacaoTexto } from './saudacao';
import GeraisCard, { EditButton } from './GeraisCard';

/** Mensagem usada para iniciar a conversa com um novo lead (modelo escolhido entre os padrões). */
const SaudacaoCard = ({ g }: { g: GeraisCtx }) => {
  const modelo = g.isTipoOutros
    ? '-'
    : g.idMensagemSaudacaoApiOficialSalvo
      ? g.saudacaoModelos.find((m) => m.id === g.idMensagemSaudacaoApiOficialSalvo)?.titulo || g.idMensagemSaudacaoApiOficialSalvo
      : '-';

  return (
    <GeraisCard
      id="ger-saudacao"
      icon={<MessageCircle aria-hidden="true" />}
      title="Mensagem de Saudação"
      sub="Mensagem usada para iniciar conversa com um novo lead."
      action={
        !g.isTipoOutros ? (
          <EditButton onClick={() => g.setIsEditingMensagemSaudacao(true)} disabled={g.isSavingMensagemSaudacao} />
        ) : undefined
      }
    >
      <div className="wl-set-box">
        <div className="wl-row">
          <span className="wl-label">Modelo selecionado</span>
          <span className="wl-tag wl-tag--plain">{modelo}</span>
        </div>
        <p className="wl-kv__value wl-kv__value--text" style={{ margin: 0 }}>
          {g.mensagemSaudacaoPortalSalva ? renderSaudacaoTexto(g.mensagemSaudacaoPortalSalva) : '-'}
        </p>
      </div>
    </GeraisCard>
  );
};

export default SaudacaoCard;
