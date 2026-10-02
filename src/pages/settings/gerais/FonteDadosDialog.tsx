import React from 'react';
import type { GeraisCtx } from './useGerais';
import GeraisDialog, { SegmentedChoice } from './GeraisDialog';

const tipos = [
  { value: 'HTML', label: 'HTML' },
  { value: 'API', label: 'API' },
  { value: 'XML', label: 'XML' },
  { value: 'INTERNO', label: 'Interno' },
];

/** Cadastro da fonte de dados: tipo (HTML, API, XML ou interno), links e body (só para API). */
const FonteDadosDialog = ({ g }: { g: GeraisCtx }) => (
  <GeraisDialog
    open={g.fontesModalOpen}
    onOpenChange={g.setFontesModalOpen}
    title="Fonte de Dados"
    description="Configure de onde os dados são coletados (HTML ou API)"
    size="md"
    footer={
      <>
        <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => g.setFontesModalOpen(false)} disabled={g.isSubmittingFontes}>
          Cancelar
        </button>
        <button type="button" className="wl-btn wl-btn--lime" onClick={g.handleSaveFonteDados} disabled={g.isSubmittingFontes || !g.tipo}>
          {g.isSubmittingFontes ? 'Salvando...' : g.fonteId ? 'Salvar alterações' : 'Salvar'}
        </button>
      </>
    }
  >
    <div className="wl-field">
      <span className="wl-label">Tipo</span>
      <SegmentedChoice label="Tipo da fonte" value={g.tipo} options={tipos} onChange={g.setTipo} />
    </div>

    {g.tipo === 'XML' && (
      <div className="wl-field">
        <label className="wl-label" htmlFor="ger-fonte-url">Link da URL</label>
        <input id="ger-fonte-url" className="wl-input" placeholder="https://" value={g.links} onChange={(e) => g.setLinks(e.target.value)} />
      </div>
    )}

    {g.tipo !== 'INTERNO' && g.tipo !== 'XML' && (
      <div className="wl-field">
        <label className="wl-label" htmlFor="ger-fonte-links">Links</label>
        <textarea
          id="ger-fonte-links"
          className="wl-input"
          rows={6}
          placeholder="Insira um ou mais links, um por linha"
          value={g.links}
          onChange={(e) => g.setLinks(e.target.value)}
        />
      </div>
    )}

    {g.tipo === 'API' && (
      <div className="wl-field">
        <label className="wl-label" htmlFor="ger-fonte-body">Body</label>
        <textarea
          id="ger-fonte-body"
          className="wl-input"
          rows={6}
          placeholder="Opcional"
          value={g.body}
          onChange={(e) => g.setBody(e.target.value)}
        />
      </div>
    )}
  </GeraisDialog>
);

export default FonteDadosDialog;
