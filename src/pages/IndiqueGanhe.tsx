import React from "react";
import { useCRM } from "@/contexts/CRMContext";
import { toast } from "sonner";
import { Copy, Check, Ticket, DollarSign } from "lucide-react";
import "@/styles/worklivoo-tokens.css";
import "@/styles/worklivoo-components.css";
import "@/styles/worklivoo-page.css";
import "@/styles/worklivoo-referral.css";

const IndiqueGanhe = () => {
  const { user } = useCRM();
  const [copied, setCopied] = React.useState(false);

  // Link de referência com mensagem personalizada para WhatsApp
  const nomeEmpresa = user?.empresa || "NOME DA EMPRESA";
  const mensagem = `A ${nomeEmpresa} me indicou vocês, gostaria de falar com você!`;
  const referralLink = `https://wa.me/5512997079459?text=${encodeURIComponent(mensagem)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wl-scope wl-page">
      <header className="wl-page__head wl-page__head--compact">
        <div>
          <p className="wl-eyebrow">Indique e Ganhe</p>
          <h1 className="wl-page__title">Conhece alguma empresa que se beneficiaria da solução?</h1>
          <p className="wl-lede">
            Agora sua indicação tem recompensa. Seu indicado ganha <strong>7 dias para testar a IA</strong> e você escolhe:
          </p>
        </div>
      </header>

      <section className="wl-section" aria-labelledby="ref-recompensa">
        <div className="wl-ref-grid">
          <div>
            <div className="wl-section__head">
              <h2 id="ref-recompensa" className="wl-section__title">Sua recompensa</h2>
              <p className="wl-lede">Escolha uma das duas quando a indicação virar cliente.</p>
            </div>

            <div className="wl-rewards">
              <article className="wl-reward">
                <span className="wl-reward__icon"><Ticket aria-hidden="true" /></span>
                <div>
                  <h3 className="wl-reward__value">100 atendimentos</h3>
                  <p className="wl-reward__label">Créditos extras</p>
                </div>
              </article>

              <article className="wl-reward">
                <span className="wl-reward__icon"><DollarSign aria-hidden="true" /></span>
                <div>
                  <h3 className="wl-reward__value">R$100 de desconto</h3>
                  <p className="wl-reward__label">Na próxima fatura</p>
                </div>
              </article>
            </div>

            <p className="wl-ref-note">*Consulte o regulamento para mais detalhes sobre a premiação.</p>
          </div>

          <div>
            <div className="wl-section__head">
              <h2 className="wl-section__title">Seu link exclusivo</h2>
              <p className="wl-lede">Compartilhe para começar a ganhar.</p>
            </div>

            <div className="wl-linkbox">
              <label className="wl-label" htmlFor="ref-link">Link de indicação</label>
              <div className="wl-input-row">
                <input id="ref-link" className="wl-input" readOnly value={referralLink} onFocus={(e) => e.currentTarget.select()} />
                <button
                  type="button"
                  className={`wl-btn ${copied ? "wl-btn--glass-ink" : "wl-btn--lime"}`}
                  onClick={handleCopy}
                  aria-live="polite"
                >
                  {copied ? <Check aria-hidden="true" width={16} height={16} /> : <Copy aria-hidden="true" width={16} height={16} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="wl-howto-wrap">
              <h3 className="wl-ref-sub">Como funciona</h3>
              <ol className="wl-howto">
                <li>
                  <span className="wl-howto__n">1</span>
                  <div>
                    <p className="wl-howto__title">Copie e envie</p>
                    <p className="wl-howto__text">Copie o link acima e envie para o indicado (amigo ou empresa).</p>
                  </div>
                </li>
                <li>
                  <span className="wl-howto__n">2</span>
                  <div>
                    <p className="wl-howto__title">Contato via WhatsApp</p>
                    <p className="wl-howto__text">
                      Ele falará conosco no WhatsApp e, se virar cliente, sua recompensa é liberada automaticamente.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="wl-section" aria-labelledby="ref-regulamento">
        <div className="wl-section__head">
          <h2 id="ref-regulamento" className="wl-section__title">Regulamento</h2>
        </div>
        <ol className="wl-rules">
          <li>Copie seu link de indicação e envie para a empresa indicada</li>
          <li>O indicado fala conosco pelo WhatsApp e passa por uma reunião com nosso time</li>
          <li>Caso faça sentido, vamos liberar 7 dias para o indicado testar a IA antes de contratar</li>
          <li>Se virar cliente, você recebe benefícios na sua assinatura</li>
        </ol>
        <p className="wl-rules-note">
          Válido para até 3 indicações convertidas por mês (limitado a 300 atendimentos ou R$300 em desconto). Indicações adicionais são contabilizadas no mês seguinte.
        </p>
      </section>
    </div>
  );
};

export default IndiqueGanhe;
