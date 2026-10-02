import React from 'react';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

/** Cartão padrão da aba Gerais: ícone, título, descrição, ação à direita e conteúdo. */
const GeraisCard = ({
  id,
  icon,
  title,
  sub,
  action,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="wl-set-card" aria-labelledby={id}>
    <div className="wl-set-card__head">
      <div className="wl-set-card__id">
        <span className="wl-set-card__icon">{icon}</span>
        <div>
          <h3 id={id} className="wl-set-card__title">{title}</h3>
          {sub && <p className="wl-set-card__sub">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** Botão "Editar" dos cartões (vidro branco sobre o painel cinza). */
export const EditButton = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => (
  <button type="button" className="wl-btn wl-btn--glass wl-btn--sm" onClick={onClick} disabled={disabled}>
    Editar
  </button>
);

export default GeraisCard;
