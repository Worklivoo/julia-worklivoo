import React from 'react';
import { Plus, X } from 'lucide-react';

/** Lista editável de telefones (+55 fixo, máscara, remover e adicionar), usada nos diálogos de Gerais. */
const PhoneListEditor = ({
  phones,
  onChange,
  format,
  keepOne,
}: {
  phones: string[];
  onChange: (next: string[]) => void;
  format: (value: string) => string;
  /** Ao remover o último número, volta para uma linha vazia em vez de zerar a lista. */
  keepOne?: boolean;
}) => (
  <div className="wl-phones">
    {phones.map((phone, index) => (
      <div key={index} className="wl-phone">
        <span className="wl-phone__ddi">+55</span>
        <input
          className="wl-input"
          value={phone}
          inputMode="tel"
          maxLength={15}
          placeholder="(11) 99999-9999"
          aria-label={`Telefone ${index + 1}`}
          onChange={(e) => {
            const next = [...phones];
            next[index] = format(e.target.value);
            onChange(next);
          }}
        />
        {phones.length > 1 && (
          <button
            type="button"
            className="wl-iconbtn wl-iconbtn--danger"
            aria-label={`Remover telefone ${index + 1}`}
            onClick={() => {
              const next = [...phones];
              next.splice(index, 1);
              onChange(keepOne && next.length === 0 ? [''] : next);
            }}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    ))}
    <button
      type="button"
      className="wl-btn wl-btn--glass wl-btn--sm"
      style={{ justifySelf: 'start' }}
      onClick={() => onChange([...phones, ''])}
    >
      <Plus aria-hidden="true" width={14} height={14} />
      Adicionar novo número
    </button>
  </div>
);

export default PhoneListEditor;
