import React from 'react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { WhatsAppConexaoCtx } from './useWhatsAppConexao';
import { CITY_OPTIONS, normalizeCitySearch, type WhatsAppCity } from './cities';

/** Escolha da cidade (usada no proxy da instância) antes de gerar o QR Code ou o código. */
const CidadeDialog = ({ c }: { c: WhatsAppConexaoCtx }) => {
  const mostrarLista = normalizeCitySearch(c.cityDialogQuery) && !c.isCityQueryExactSelection;

  const onChange = (next: string) => {
    c.setCityDialogQuery(next);
    const normalized = normalizeCitySearch(next);
    if (!normalized) {
      c.setCityDialogSelected(null);
      return;
    }
    let match: WhatsAppCity | null = null;
    for (const city of CITY_OPTIONS) {
      if (normalizeCitySearch(city.label) === normalized) {
        if (match) {
          match = null;
          break;
        }
        match = city;
      }
    }
    c.setCityDialogSelected(match);
  };

  return (
    <GeraisDialog
      open={c.cityDialogOpen}
      onOpenChange={c.setCityDialogOpen}
      title="Selecione a cidade"
      description={`Informe de qual cidade você está hoje para gerar o ${c.connectionMethod === 'qrcode' ? 'QR Code' : 'código'}.`}
      footer={
        <>
          <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => c.setCityDialogOpen(false)}>
            Cancelar
          </button>
          <button type="button" className="wl-btn wl-btn--lime" onClick={c.handleConfirmCityAndConnect} disabled={!c.cityDialogSelected}>
            Gerar
          </button>
        </>
      }
    >
      <div className="wl-field">
        <label className="wl-label" htmlFor="wa-cidade">Cidade</label>
        <input
          id="wa-cidade"
          className="wl-input"
          value={c.cityDialogQuery}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite a cidade"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && c.cityDialogSelected) {
              e.preventDefault();
              c.handleConfirmCityAndConnect();
            }
          }}
        />
        {mostrarLista ? (
          <div className="wl-citylist" role="listbox" aria-label="Cidades encontradas">
            {c.cityMatches.length ? (
              c.cityMatches.map((city) => (
                <button
                  key={city.value}
                  type="button"
                  role="option"
                  aria-selected={c.cityDialogSelected?.value === city.value}
                  className={`wl-citylist__item${c.cityDialogSelected?.value === city.value ? ' is-active' : ''}`}
                  onClick={() => {
                    c.setCityDialogSelected(city);
                    c.setCityDialogQuery(city.label);
                  }}
                >
                  <strong>{city.label}</strong>
                  {city.state_label ? <span>{city.state_label}</span> : null}
                </button>
              ))
            ) : (
              <p className="wl-wa__hint" style={{ padding: 12 }}>Nenhuma cidade encontrada.</p>
            )}
          </div>
        ) : null}
      </div>
    </GeraisDialog>
  );
};

export default CidadeDialog;
