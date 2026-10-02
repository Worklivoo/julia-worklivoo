import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, User } from 'lucide-react';
import { formatPhone } from '@/lib/lead-detail-utils';
import type { FollowUpKind } from './kinds';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

const text = (value: unknown) => String(value ?? '').trim() || '-';

/** Histórico de FollowUps enviados (só os já confirmados), igual para Dinâmico e Extendido. */
const FollowUpHistorico = ({ kind, historico, loading }: { kind: FollowUpKind; historico: any[]; loading: boolean }) => {
  const navigate = useNavigate();

  return (
    <section className="wl-tabsection" aria-labelledby={`fu-historico-${kind.id}`}>
      <div className="wl-tabsection__head">
        <div>
          <h3 id={`fu-historico-${kind.id}`} className="wl-section__title">Histórico de FollowUps enviados</h3>
          <p className="wl-lede">Mostra apenas os envios já confirmados.</p>
        </div>
        <span className="wl-tabsection__count">
          {loading ? 'Carregando...' : `${historico.length} registro${historico.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {loading ? (
        <p className="wl-clist__note">Carregando...</p>
      ) : historico.length === 0 ? (
        <div className="wl-empty">
          <span className="wl-empty__icon"><History aria-hidden="true" /></span>
          <p className="wl-empty__title">Nenhum FollowUp {kind.nome} enviado ainda</p>
          <p className="wl-empty__text">Os envios confirmados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="wl-tbl-wrap">
          <table className="wl-tbl wl-tbl--wide">
            <thead>
              <tr>
                <th>Data</th>
                <th>Lead</th>
                <th>Telefone</th>
                <th>Item de interesse</th>
                <th>Item novo</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((row, idx) => {
                const leadId = String(row?.lead_id || '').trim();
                const nome = text(row?.lead_nome_pessoa);
                const telefoneRaw = String(row?.lead_telefone || '').trim();
                const key = `${row?.idx ?? idx}-${row?.lead_id ?? idx}-${row?.criado_em ?? idx}`;
                const abrir = () => {
                  if (leadId) navigate(`/lead/${leadId}`);
                };
                return (
                  <tr
                    key={key}
                    className={leadId ? 'is-link' : undefined}
                    tabIndex={leadId ? 0 : undefined}
                    onClick={leadId ? abrir : undefined}
                    onKeyDown={leadId ? (e) => { if (e.key === 'Enter') abrir(); } : undefined}
                  >
                    <td className="is-nowrap">{row?.criado_em ? new Date(String(row.criado_em)).toLocaleString('pt-BR') : '-'}</td>
                    <td>
                      <div className="wl-tbl__who">
                        <span className="wl-avatar" aria-hidden="true"><User width={14} height={14} /></span>
                        <span title={nome}>{nome}</span>
                      </div>
                    </td>
                    <td className="is-nowrap">{telefoneRaw ? formatPhone(telefoneRaw.replace(/\D/g, '')) : '-'}</td>
                    <td className="is-wrap" title={text(row?.item_interesse)}>{text(row?.item_interesse)}</td>
                    <td className="is-wrap is-strong" title={text(row?.item_novo)}>{text(row?.item_novo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default FollowUpHistorico;
