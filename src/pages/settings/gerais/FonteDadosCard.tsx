import React from 'react';
import { Database } from 'lucide-react';
import type { GeraisCtx } from './useGerais';
import GeraisCard, { EditButton } from './GeraisCard';

/** De onde os dados de estoque são coletados (HTML, API, XML ou interno). */
const FonteDadosCard = ({ g }: { g: GeraisCtx }) => (
  <GeraisCard
    id="ger-fonte"
    icon={<Database aria-hidden="true" />}
    title="Fonte de Dados"
    sub="Configure de onde os dados são coletados (HTML ou API)"
    action={<EditButton onClick={g.openFontesModal} />}
  >
    {g.loadingFontes ? (
      <p className="wl-clist__note">Carregando...</p>
    ) : g.fontes.length > 0 ? (
      <div className="wl-set-box wl-fonte">
        <div className="wl-kv">
          <span className="wl-label">Tipo</span>
          <span className="wl-kv__value">{g.fontes[0]?.tipo || '-'}</span>
        </div>
        <div className="wl-kv">
          <span className="wl-label">Links</span>
          <span className="wl-kv__value">{g.fontes[0]?.link || '-'}</span>
        </div>
        {g.fontes[0]?.body && (
          <div className="wl-kv">
            <span className="wl-label">Body</span>
            <span className="wl-kv__value">{g.fontes[0]?.body}</span>
          </div>
        )}
      </div>
    ) : (
      <p className="wl-set-box wl-kv__value wl-kv__value--text">Nenhuma fonte cadastrada ainda.</p>
    )}
  </GeraisCard>
);

export default FonteDadosCard;
