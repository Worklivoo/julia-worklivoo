import React from 'react';
import { ArrowDown, ArrowRight, CheckCircle2, Crown, Sparkles, XCircle, Zap } from 'lucide-react';
import type { FollowUpKind } from './kinds';
import type { FollowUpPagamentoCtx } from './useFollowUpPagamento';
import ContratarDialog from './ContratarDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

/** Tela de aquisição de um FollowUp pago (Dinâmico ou Extendido): apresentação + diálogo de contratação. */
const FollowUpContratar = ({ kind, pagamento }: { kind: FollowUpKind; pagamento: FollowUpPagamentoCtx }) => (
  <div className="wl-tabpane">
    <header className="wl-hero">
      <div className="wl-hero__text">
        <div className="wl-pills" style={{ marginTop: 0 }}>
          <span className="wl-pill wl-pill--soft wl-pill--icon">
            <Crown aria-hidden="true" />
            Funcionalidade Premium
          </span>
          <span className="wl-pill wl-pill--soft wl-pill--icon">
            <Zap aria-hidden="true" />
            Ativação imediata via PIX
          </span>
        </div>
        <h2 className="wl-hero__title">FollowUp {kind.nome}</h2>
        <p className="wl-lede">{kind.copy.contratarLede}</p>
      </div>

      <button type="button" className="wl-btn wl-btn--lime" onClick={pagamento.handleAcquireClick}>
        <Crown aria-hidden="true" width={16} height={16} />
        Adquirir FollowUp {kind.nome}
      </button>
    </header>

    <section className="wl-flow" aria-labelledby={`fu-como-funciona-${kind.id}`}>
      <h3 id={`fu-como-funciona-${kind.id}`} className="wl-eyebrow" style={{ margin: 0 }}>Como funciona</h3>

      <div className="wl-flow__legend">
        <div className="wl-flow__key">
          <XCircle aria-hidden="true" />
          <div>
            <strong>Uso atual</strong>
            <span>Etapas 1 e 2 · Como o fluxo funciona sem a ferramenta</span>
          </div>
        </div>
        <div className="wl-flow__key wl-flow__key--ink">
          <Sparkles aria-hidden="true" />
          <div>
            <strong>Nova funcionalidade</strong>
            <span>Etapas 3 e 4 · O que muda com o FollowUp {kind.nome}</span>
          </div>
        </div>
      </div>

      <ol className="wl-flow__steps">
        {kind.copy.steps.map((step, idx) => (
          <li key={step.title} className={`wl-step ${idx >= 2 ? 'wl-step--ink' : ''}`}>
            <span className="wl-step__n">{idx + 1}</span>
            <h4 className="wl-step__title">{step.title}</h4>
            <p className="wl-step__text">{step.desc}</p>
          </li>
        ))}
      </ol>

      <div className="wl-flow__result">
        <span className="wl-pill wl-pill--icon">
          <XCircle aria-hidden="true" />
          {kind.copy.resultFrom}
        </span>
        <ArrowRight aria-hidden="true" className="hidden sm:block" />
        <ArrowDown aria-hidden="true" className="sm:hidden" />
        <span className="wl-pill wl-pill--ink wl-pill--icon">
          <CheckCircle2 aria-hidden="true" />
          {kind.copy.resultTo}
        </span>
      </div>
    </section>

    <ContratarDialog pagamento={pagamento} kind={kind} />
  </div>
);

export default FollowUpContratar;
