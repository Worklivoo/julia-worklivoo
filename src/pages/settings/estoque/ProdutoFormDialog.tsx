import React from 'react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { EstoqueCtx } from './useEstoque';
import { camposDe, valorDigitado, valorExibido, type Campo } from './campos';

/** Diálogo de produto (carro ou imóvel), usado para adicionar e para editar. Os campos vêm de `campos.ts`. */
const ProdutoFormDialog = ({ e, mode }: { e: EstoqueCtx; mode: 'add' | 'edit' }) => {
  const kind = e.estoqueKind;
  if (!kind) return null;

  const adicionando = mode === 'add';
  const campos = camposDe(kind);

  // Cada modo/tipo tem o seu estado de formulário (mantido como no hook original).
  const form: Record<string, any> = adicionando
    ? kind === 'carro' ? e.addForm : e.addImovelForm
    : kind === 'carro' ? e.editForm : e.editImovelForm;
  const setForm: (fn: (prev: any) => any) => void = adicionando
    ? kind === 'carro' ? e.setAddForm : e.setAddImovelForm
    : kind === 'carro' ? e.setEditForm : e.setEditImovelForm;

  const salvando = adicionando ? e.savingAdd : e.savingEdit;
  const formId = `estoque-${mode}-form`;

  const renderCampo = (campo: Campo) => {
    const id = `${mode}-${campo.key}`;
    const onChange = (texto: string) => setForm((prev) => ({ ...prev, [campo.key]: valorDigitado(campo, texto) }));
    return (
      <div key={campo.key} className={`wl-field${campo.largo ? ' is-span' : ''}`}>
        <label className="wl-label" htmlFor={id}>{campo.label}</label>
        {campo.tipo === 'textarea' ? (
          <textarea
            id={id}
            className="wl-input"
            style={{ minHeight: campo.altura }}
            value={String(form[campo.key] ?? '')}
            onChange={(ev) => onChange(ev.target.value)}
            placeholder={campo.placeholder}
          />
        ) : (
          <input
            id={id}
            className="wl-input"
            value={valorExibido(campo, form[campo.key])}
            onChange={(ev) => onChange(ev.target.value)}
            placeholder={campo.placeholder}
            inputMode={campo.tipo === 'text' ? undefined : 'numeric'}
          />
        )}
      </div>
    );
  };

  const normais = campos.filter((c) => !c.trio);
  const trio = campos.filter((c) => c.trio);
  // O trio (quartos, banheiros, vagas) entra logo depois do último campo de valor, como no formulário original.
  const indiceTrio = normais.findIndex((c) => c.key === 'imovel_valor_iptu') + 1;

  return (
    <GeraisDialog
      open={adicionando ? e.addOpen : e.editOpen}
      onOpenChange={(open) => {
        if (adicionando) {
          e.setAddOpen(open);
        } else {
          if (!open) e.setEditing(null);
          e.setEditOpen(open);
        }
      }}
      title={adicionando ? 'Adicionar produto' : 'Editar produto'}
      description={
        adicionando
          ? 'Preencha os campos para inserir um novo produto no estoque.'
          : 'Atualize os campos e salve para aplicar no estoque.'
      }
      size="xl"
      footer={
        <>
          <button
            type="button"
            className="wl-btn wl-btn--glass-ink"
            onClick={() => (adicionando ? e.setAddOpen(false) : e.setEditOpen(false))}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button type="submit" form={formId} className="wl-btn wl-btn--lime" disabled={salvando}>
            {adicionando ? (salvando ? 'Adicionando...' : 'Adicionar') : salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="wl-subgrid"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (adicionando) e.handleCreateNew();
          else e.handleSaveEdit();
        }}
      >
        {indiceTrio > 0 ? (
          <>
            {normais.slice(0, indiceTrio).map(renderCampo)}
            <div className="wl-trio is-span">{trio.map(renderCampo)}</div>
            {normais.slice(indiceTrio).map(renderCampo)}
          </>
        ) : (
          normais.map(renderCampo)
        )}
      </form>
    </GeraisDialog>
  );
};

export default ProdutoFormDialog;
