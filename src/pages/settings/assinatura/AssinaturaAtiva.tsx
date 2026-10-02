import React from 'react';
import { AlertCircle, Banknote, CheckCircle2, Download, QrCode, RefreshCw, Zap } from 'lucide-react';
import type { AssinaturaCtx } from './useAssinatura';
import AnteciparDialogs from './AnteciparDialogs';

const brl = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const statusFatura = (status: string) => {
  if (status === 'CONFIRMED' || status === 'RECEIVED') return { rotulo: 'Pago', tag: 'wl-tag--won', icone: <CheckCircle2 aria-hidden="true" /> };
  if (status === 'OVERDUE') return { rotulo: 'Atrasado', tag: 'wl-tag--alert', icone: <AlertCircle aria-hidden="true" /> };
  if (status === 'REFUNDED') return { rotulo: 'Estornado', tag: 'wl-tag--idle', icone: <RefreshCw aria-hidden="true" /> };
  return { rotulo: 'Pendente', tag: 'wl-tag--plain', icone: <CheckCircle2 aria-hidden="true" /> };
};

/** Assinatura ativa: forma de pagamento, faturas recentes, plano, valor mensal e uso do plano. */
const AssinaturaAtiva = ({ a }: { a: AssinaturaCtx }) => {
  const pix = a.cardFinal === 'PIX';
  const nome = String(a.formData.nome || '').trim();
  const partes = nome.split(/\s+/);
  const titular = nome ? (partes.length > 2 ? `${partes[0]} ${partes[1]}...` : nome) : 'Cliente';
  const faturas = a.showAllInvoices ? a.visibleInvoices : a.visibleInvoices.slice(0, 3);
  const pct = Math.round((a.currentMonthLeads / (a.userPlanLimit || 1)) * 100);
  const acima = a.currentMonthLeads > a.userPlanLimit;

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <h3 className="wl-section__title">Minha assinatura</h3>
          <p className="wl-lede">Gerencie seu plano, faturas e acompanhe o uso do sistema.</p>
        </div>
      </div>

      <div className="wl-assin">
        <div className="wl-assin__col">
          {pix ? (
            <div className="wl-pcard wl-pcard--pix">
              <div className="wl-pcard__top">
                <span className="wl-pcard__chip"><QrCode aria-hidden="true" /></span>
                <Banknote aria-hidden="true" />
              </div>
              <div>
                <p className="wl-pcard__title">Pagamento via PIX</p>
                <p className="wl-pcard__sub">As faturas são enviadas mensalmente.</p>
                <div className="wl-pcard__row">
                  <div>
                    <span className="wl-pcard__label">Titular</span>
                    <span className="wl-pcard__value">{nome || 'Cliente'}</span>
                  </div>
                  <div>
                    <span className="wl-pcard__label">Status</span>
                    <span className="wl-pcard__value">Ativo</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="wl-pcard">
              <div className="wl-pcard__top">
                <span className="wl-pcard__chip"><i /></span>
                <Zap aria-hidden="true" />
              </div>
              <div>
                <p className="wl-pcard__number">•••• •••• •••• {a.cardFinal || '0000'}</p>
                <div className="wl-pcard__row">
                  <div>
                    <span className="wl-pcard__label">Titular</span>
                    <span className="wl-pcard__value">{titular}</span>
                  </div>
                  <div>
                    <span className="wl-pcard__label">Status</span>
                    <span className="wl-pcard__value">Ativo</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="wl-set-card" aria-labelledby="ass-faturas">
            <div className="wl-set-card__head">
              <h3 id="ass-faturas" className="wl-set-card__title">Faturas recentes</h3>
              <button type="button" className="wl-iconbtn" onClick={a.fetchInvoices} disabled={a.isLoadingInvoices} aria-label="Atualizar faturas" title="Atualizar faturas">
                <RefreshCw className={a.isLoadingInvoices ? 'wl-estoque__spin' : undefined} aria-hidden="true" />
              </button>
            </div>

            {a.isLoadingInvoices ? (
              <p className="wl-clist__note wl-clist__note--center" role="status">Carregando...</p>
            ) : a.visibleInvoices.length > 0 ? (
              <ul className="wl-inv-list">
                {faturas.map((inv, i) => {
                  const st = statusFatura(inv.status);
                  const dataBase = (inv as any).dueDate || inv.clientPaymentDate || inv.dateCreated;
                  return (
                    <li key={inv.id || i}>
                      <button type="button" className="wl-inv" onClick={() => window.open(inv.invoiceUrl, '_blank')}>
                        <span className="wl-inv__icon">{st.icone}</span>
                        <span className="wl-inv__main">
                          <strong>{new Date(new Date(dataBase).getTime() + 86400000).toLocaleDateString('pt-BR')}</strong>
                          <span className={`wl-tag ${st.tag}`}>{st.rotulo}</span>
                        </span>
                        <span className="wl-inv__value">
                          {brl(inv.value)}
                          <Download aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="wl-clist__note wl-clist__note--center">Nenhuma fatura encontrada.</p>
            )}

            {a.visibleInvoices.length > 3 && (
              <button type="button" className="wl-btn wl-btn--glass wl-btn--sm" style={{ justifySelf: 'center' }} onClick={() => a.setShowAllInvoices(!a.showAllInvoices)}>
                {a.showAllInvoices ? 'Ver menos' : 'Ver todas as faturas'}
              </button>
            )}
          </section>
        </div>

        <div className="wl-assin__col">
          <div className="wl-subgrid">
            <div className="wl-set-card">
              <span className="wl-label">Plano atual</span>
              <p className="wl-assin__big">{a.userPlanName || '-'}</p>
              <div className="wl-pillrow">
                <span className="wl-tag wl-tag--won">{a.renewalDays !== null ? `Renovação em ${a.renewalDays} dias` : 'Renovação mensal'}</span>
                {a.planStatus && <span className="wl-tag wl-tag--plain">{a.planStatus}</span>}
              </div>
            </div>

            <div className="wl-set-card">
              <span className="wl-label">Valor mensal</span>
              <p className="wl-assin__big">{brl(a.userPlanValue || 0)}</p>
              <p className="wl-wa__hint">
                Pagamento: {pix ? 'PIX' : a.cardFinal ? `Cartão •••• ${a.cardFinal}` : '-'}
              </p>
            </div>
          </div>

          <section className="wl-set-card" aria-labelledby="ass-uso">
            <div className="wl-row">
              <div>
                <span id="ass-uso" className="wl-label">Uso do plano</span>
                <p className="wl-assin__usage">
                  <strong>{a.currentMonthLeads.toLocaleString()}</strong>
                  <span>/ {a.userPlanLimit.toLocaleString()}</span>
                </p>
                {a.usagePeriodLabel && <p className="wl-wa__hint">{a.usagePeriodLabel}</p>}
              </div>
              <div className="wl-assin__pct">
                <strong>{pct}%</strong>
                <span className="wl-label">No mês</span>
              </div>
            </div>

            <div className="wl-assin__bar" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}>
              <i className={acima ? 'is-over' : undefined} style={{ width: `${Math.min(100, (a.currentMonthLeads / (a.userPlanLimit || 1)) * 100)}%` }} />
            </div>

            <p className={`wl-assin__note${acima ? ' is-over' : ''}`}>
              {acima ? (
                <>
                  <AlertCircle aria-hidden="true" />
                  {a.currentMonthLeads - a.userPlanLimit} leads acima do plano base
                </>
              ) : (
                `${pct}% do plano base utilizado`
              )}
            </p>

            {a.currentMonthLeads >= a.userPlanLimit && (
              <button type="button" className="wl-btn wl-btn--danger wl-btn--block" onClick={a.openAdvanceInvoice} disabled={a.isAdvancingInvoice}>
                {a.isAdvancingInvoice ? 'Processando...' : 'Antecipar fatura'}
              </button>
            )}
          </section>
        </div>
      </div>

      <AnteciparDialogs a={a} />
    </div>
  );
};

export default AssinaturaAtiva;
