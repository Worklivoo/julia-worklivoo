import React from 'react';
import { Crown, FileText, KeyRound, Settings as SettingsIcon } from 'lucide-react';
import type { GeraisCtx } from './useGerais';
import '@/styles/worklivoo-settings.css';

const planoLabel = (user: any) => {
  const planName = (user.planoNome || '').trim();
  const leads =
    user.planoQuantidadeLeads !== null && user.planoQuantidadeLeads !== undefined
      ? String(user.planoQuantidadeLeads)
      : (user.plano || '').trim();
  if (!planName && !leads) return '-';
  if (!planName) return `${leads} Leads/mês`;
  if (!leads) return planName;
  return `${planName} - ${leads} Leads/mês`;
};

/** Dados da conta, plano e atalhos para alterar senha e ver os termos de uso. */
const ContaCard = ({ user, g }: { user: any; g: GeraisCtx }) => (
  <section className="wl-set-card" aria-labelledby="ger-conta">
    <div className="wl-set-card__head">
      <div className="wl-set-card__id">
        <span className="wl-set-card__icon"><SettingsIcon aria-hidden="true" /></span>
        <div>
          <h3 id="ger-conta" className="wl-set-card__title">Conta</h3>
          <p className="wl-set-card__sub">Informações do seu usuário</p>
        </div>
      </div>
      <span className="wl-tag wl-tag--plain">{user.cliente_status || '-'}</span>
    </div>

    <div className="wl-set-box">
      <div className="wl-kv">
        <span className="wl-label">Nome do usuário</span>
        <span className="wl-kv__value wl-kv__value--lg">{user.nome}</span>
      </div>
      <div className="wl-kv">
        <span className="wl-label">E-mail do usuário</span>
        <span className="wl-kv__value">{user.email}</span>
      </div>
      <div className="wl-kv">
        <span className="wl-label">ID do usuário</span>
        <span className="wl-kv__value wl-kv__value--mono">{user.id}</span>
      </div>
    </div>

    <div className="wl-set-box">
      <div className="wl-kv">
        <span className="wl-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Crown aria-hidden="true" width={13} height={13} />
          Plano do usuário
        </span>
        <span className="wl-kv__value">{planoLabel(user)}</span>
      </div>
    </div>

    <div className="wl-actions-list">
      <button type="button" className="wl-link" onClick={() => g.setChangePasswordOpen(true)}>
        <KeyRound aria-hidden="true" />
        Alterar senha
      </button>
      <button type="button" className="wl-link" onClick={() => g.setTermsOpen(true)}>
        <FileText aria-hidden="true" />
        Visualizar termos
      </button>
    </div>
  </section>
);

export default ContaCard;
