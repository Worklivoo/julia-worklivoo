import React from 'react';
import { ChevronRight, CreditCard, User } from 'lucide-react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { AssinaturaCtx } from './useAssinatura';

const brl = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

/** Configuração da assinatura: dados de faturamento (passo 1) e dados do cartão (passo 2). */
const ConfigurarAssinatura = ({ a }: { a: AssinaturaCtx }) => {
  const totalPassos = a.paymentMethod === 'PIX' ? 1 : 2;
  const campo = (
    id: string,
    label: string,
    chave: string,
    placeholder: string,
    opcoes?: { type?: string; span?: boolean; inputMode?: 'numeric' }
  ) => (
    <div key={id} className={`wl-field${opcoes?.span ? ' is-span2' : ''}`}>
      <label className="wl-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="wl-input"
        type={opcoes?.type || 'text'}
        placeholder={placeholder}
        value={(a.formData as any)[chave]}
        onChange={(e) => a.handleInputChange(chave, e.target.value)}
        disabled={a.isLoading}
        inputMode={opcoes?.inputMode}
      />
    </div>
  );

  const telefone = (() => {
    const digits = String(a.formData.telefoneFaturamento || '').replace(/\D/g, '');
    return digits.startsWith('55') ? digits.slice(2) : digits;
  })();

  return (
    <div className="wl-tabpane">
      <section className="wl-set-card" aria-labelledby="ass-config">
        <div className="wl-set-card__head">
          <div>
            <h3 id="ass-config" className="wl-set-card__title">Configurar assinatura</h3>
            <p className="wl-set-card__sub">Passo {a.setupStep} de {totalPassos}</p>
          </div>
        </div>

        <div className="wl-steps" style={{ gridTemplateColumns: `repeat(${totalPassos}, 1fr)`, margin: 0 }} aria-hidden="true">
          <div className={`wl-steps__bar${a.setupStep >= 1 ? ' is-on' : ''}`} />
          {a.paymentMethod !== 'PIX' && <div className={`wl-steps__bar${a.setupStep >= 2 ? ' is-on' : ''}`} />}
        </div>

        <div className="wl-set-box">
          {a.setupStep === 1 ? (
            <>
              <div className="wl-set-card__id">
                <span className="wl-set-card__icon"><User aria-hidden="true" /></span>
                <h4 className="wl-sub-card__sec">Dados de faturamento</h4>
              </div>
              <div className="wl-bill">
                {campo('ass-nome', 'Nome completo', 'nome', 'Ex: João Silva')}
                {campo('ass-doc', 'CPF ou CNPJ', 'documento', '000.000.000-00')}
                {campo('ass-emailnf', 'E-mail para NF', 'emailNf', 'notafiscal@empresa.com', { type: 'email' })}

                <div className="wl-field">
                  <label className="wl-label" htmlFor="ass-tel">Telefone faturamento</label>
                  <div className="wl-phone">
                    <span className="wl-phone__ddi">55</span>
                    <input
                      id="ass-tel"
                      className="wl-input"
                      type="tel"
                      placeholder="12XXXXXXXXX"
                      value={telefone}
                      onChange={(e) => {
                        const digits = String(e.target.value || '').replace(/\D/g, '');
                        const rest = digits.startsWith('55') ? digits.slice(2) : digits;
                        a.handleInputChange('telefoneFaturamento', rest ? `55${rest}` : '');
                      }}
                      disabled={a.isLoading}
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="wl-field">
                  <label className="wl-label" htmlFor="ass-cep">CEP</label>
                  <div className="wl-input-row">
                    <input
                      id="ass-cep"
                      className="wl-input"
                      type="text"
                      placeholder="00000-000"
                      value={a.formData.cep}
                      onChange={(e) => a.handleCepChange(e.target.value)}
                      disabled={a.isLoading}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="wl-btn wl-btn--glass-ink"
                      onClick={a.handleFillCepButtonClick}
                      disabled={a.isLoading || a.isFetchingCep}
                    >
                      Preencher
                    </button>
                  </div>
                  {a.isFetchingCep && <p className="wl-wa__hint">Buscando CEP...</p>}
                </div>

                {campo('ass-estado', 'Estado', 'estado', 'SP')}
                {campo('ass-cidade', 'Cidade', 'cidade', 'São Paulo')}
                {campo('ass-endereco', 'Endereço (Rua/Avenida)', 'endereco', 'Rua Exemplo', { span: true })}
                {campo('ass-numero', 'Número', 'numero', '123')}
                {campo('ass-bairro', 'Bairro', 'bairro', 'Centro')}
                {campo('ass-complemento', 'Complemento', 'complemento', 'Apto 12, Bloco B', { span: true })}
              </div>
            </>
          ) : (
            <>
              <div className="wl-set-card__id">
                <span className="wl-set-card__icon"><CreditCard aria-hidden="true" /></span>
                <h4 className="wl-sub-card__sec">Dados do cartão</h4>
              </div>
              <div className="wl-modal__stack">
                <div className="wl-field">
                  <label className="wl-label" htmlFor="ass-holder">Nome no cartão</label>
                  <input
                    id="ass-holder"
                    className="wl-input"
                    type="text"
                    placeholder="Como está impresso no cartão"
                    value={a.cardData.holderName}
                    onChange={(e) => a.handleCardChange('holderName', e.target.value)}
                    disabled={a.isLoading}
                  />
                </div>
                <div className="wl-field">
                  <label className="wl-label" htmlFor="ass-numcartao">Número do cartão</label>
                  <input
                    id="ass-numcartao"
                    className="wl-input"
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    value={a.cardData.number}
                    onChange={(e) => a.handleCardChange('number', e.target.value)}
                    disabled={a.isLoading}
                  />
                </div>
                <div className="wl-trio">
                  <div className="wl-field">
                    <label className="wl-label" htmlFor="ass-mes">Mês</label>
                    <input
                      id="ass-mes"
                      className="wl-input"
                      type="text"
                      placeholder="MM"
                      maxLength={2}
                      value={a.cardData.expiryMonth}
                      onChange={(e) => a.handleCardChange('expiryMonth', e.target.value)}
                      disabled={a.isLoading}
                    />
                  </div>
                  <div className="wl-field">
                    <label className="wl-label" htmlFor="ass-ano">Ano</label>
                    <input
                      id="ass-ano"
                      className="wl-input"
                      type="text"
                      placeholder="AA"
                      maxLength={4}
                      value={a.cardData.expiryYear}
                      onChange={(e) => a.handleCardChange('expiryYear', e.target.value)}
                      disabled={a.isLoading}
                    />
                  </div>
                  <div className="wl-field">
                    <label className="wl-label" htmlFor="ass-cvv">CVV</label>
                    <input
                      id="ass-cvv"
                      className="wl-input"
                      type="text"
                      placeholder="000"
                      maxLength={4}
                      value={a.cardData.ccv}
                      onChange={(e) => a.handleCardChange('ccv', e.target.value)}
                      disabled={a.isLoading}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="wl-modal__foot wl-modal__foot--end" style={{ marginTop: 0 }}>
          {a.setupStep === 2 && (
            <button
              type="button"
              className="wl-btn wl-btn--glass-ink"
              onClick={() => (a.cardFinal ? a.setIsCardSaved(true) : a.setIsSaved(false))}
              disabled={a.isLoading}
            >
              {a.cardFinal ? 'Cancelar' : 'Voltar'}
            </button>
          )}
          <button
            type="button"
            className="wl-btn wl-btn--lime"
            onClick={a.setupStep === 1 ? a.handleSave : a.handleOpenCardChargeConfirm}
            disabled={a.isLoading}
          >
            {a.isLoading ? (
              <>
                <span className="wl-spinner" aria-hidden="true" />
                Processando...
              </>
            ) : (
              <>
                {a.setupStep === 1 ? 'Continuar' : 'Confirmar e ativar'}
                <ChevronRight aria-hidden="true" width={16} height={16} />
              </>
            )}
          </button>
        </div>

        <p className="wl-wa__hint" style={{ textAlign: 'center' }}>Pagamento processado de forma segura via Asaas</p>
      </section>

      <GeraisDialog
        open={a.showCardChargeConfirm}
        onOpenChange={a.setShowCardChargeConfirm}
        title="Confirmar pagamento no cartão"
        description={`Será cobrado ${brl(a.userPlanValue || 0)}${
          a.userPlanName ? ` referente ao plano ${String(a.userPlanName).trim()}.` : '.'
        }`}
        footer={
          <>
            <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => a.setShowCardChargeConfirm(false)} disabled={a.isLoading}>
              Cancelar
            </button>
            <button
              type="button"
              className="wl-btn wl-btn--lime"
              disabled={a.isLoading}
              onClick={async () => {
                a.setShowCardChargeConfirm(false);
                await a.handleSaveCard();
              }}
            >
              Confirmar
            </button>
          </>
        }
      >
        <span />
      </GeraisDialog>
    </div>
  );
};

export default ConfigurarAssinatura;
