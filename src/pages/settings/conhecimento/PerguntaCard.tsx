import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { BaseConhecimentoCtx, ConhecimentoItem } from './useBaseConhecimento';

/** Uma pergunta com a resposta, o interruptor de ativo/inativo e (para administradores) editar e remover. */
const PerguntaCard = ({ item, k }: { item: ConhecimentoItem; k: BaseConhecimentoCtx }) => {
  const ativo = item.ativo_inativo ?? false;

  return (
    <article className="wl-qa">
      <div className={`wl-qa__body${ativo ? '' : ' is-off'}`}>
        <div className="wl-kv">
          <span className="wl-label">Pergunta</span>
          <span className="wl-kv__value wl-kv__value--text wl-qa__q">{item.pergunta}</span>
        </div>
        <div className="wl-kv">
          <span className="wl-label">Resposta</span>
          <span className="wl-kv__value wl-kv__value--text">{item.resposta}</span>
        </div>
      </div>

      <div className="wl-qa__side">
        <label className="wl-qa__switch">
          <span className={`wl-tag ${ativo ? 'wl-tag--won' : 'wl-tag--plain'}`}>{ativo ? 'Ativo' : 'Inativo'}</span>
          <Switch
            checked={ativo}
            onCheckedChange={(checked) => k.handleToggleStatus(item, checked)}
            disabled={!k.isAdmin}
            aria-label={ativo ? 'Desativar pergunta' : 'Ativar pergunta'}
            className="data-[state=checked]:bg-[var(--ink)]"
          />
        </label>
        {k.isAdmin && (
          <div className="wl-qa__actions">
            <button type="button" className="wl-iconbtn" aria-label="Editar pergunta" onClick={() => k.openEdit(item)}>
              <Pencil aria-hidden="true" />
            </button>
            <button type="button" className="wl-iconbtn wl-iconbtn--danger" aria-label="Remover pergunta" onClick={() => k.openDelete(item)}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default PerguntaCard;
