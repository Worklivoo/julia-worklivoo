import React from 'react';
import type { FollowUpPagamentoCtx } from './useFollowUpPagamento';
import type { FollowUpKind } from './kinds';
import '@/styles/worklivoo-settings.css';

/** Passo 1: escolha do plano. */
const ContratarPlanoStep = ({ pagamento, kind }: { pagamento: FollowUpPagamentoCtx; kind: FollowUpKind }) => {
  const { plans, selectedPlanId, setSelectedPlanId, handleCloseAcquireDialog, handleAcquireNext } = pagamento;

  return (
    <div>
      <div className="wl-stephead">
        <div>
          <h3>1. Selecione o plano</h3>
          <p>Escolha a opção que melhor se encaixa no volume da sua operação.</p>
        </div>
        <span className="wl-pill">Passo 1 de 3</span>
      </div>

      <div className="wl-plans" role="radiogroup" aria-label="Planos disponíveis">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`wl-plan ${isSelected ? 'is-selected' : ''}`}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              {plan.recomendado && <span className="wl-tag wl-tag--won wl-plan__tag">Mais escolhido</span>}
              <span className="wl-plan__name">{plan.nome}</span>
              <span className="wl-plan__price">
                <small>R$</small>
                <strong>{plan.preco}</strong>
                <small>/mês</small>
              </span>
              <p className="wl-plan__desc">{plan.descricao}</p>
              <div className="wl-plan__inc">
                <span className="wl-label">O que está incluso</span>
                <ul className="wl-bullets">
                  {kind.planIncludes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <span className="wl-plan__vol">
                  Até {plan.volume.toLocaleString('pt-BR')} leads reativados por ciclo mensal
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="wl-footrow">
        <button type="button" className="wl-link" onClick={handleCloseAcquireDialog}>Cancelar</button>
        <div className="wl-footrow__end">
          <button type="button" className="wl-btn wl-btn--lime" onClick={handleAcquireNext}>Continuar</button>
        </div>
      </div>
    </div>
  );
};

export default ContratarPlanoStep;
