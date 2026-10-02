import React from 'react';
import type { GeraisCtx } from './useGerais';
import { formatPhoneInput } from './phones';
import GeraisDialog, { SegmentedChoice } from './GeraisDialog';
import PhoneListEditor from './PhoneListEditor';

/** Como a equipe é avisada no transbordo: WhatsApp ou Roleta, com os números de cada método. */
const TransbordoMetodoDialog = ({ g }: { g: GeraisCtx }) => {
  const draft = g.transbordoMetodoAvisoDraft;

  const cancelar = () => {
    g.setTransbordoMetodoAvisoDraft(g.transbordoMetodoAviso);
    g.setTransbordoTelefonesDraft(g.getTransbordoPhonesForMethod(g.transbordoMetodoAviso));
    g.setTransbordoMetodoAvisoOpen(false);
  };

  return (
    <GeraisDialog
      open={g.transbordoMetodoAvisoOpen}
      onOpenChange={(open) => {
        g.setTransbordoMetodoAvisoOpen(open);
        if (open) {
          g.setTransbordoMetodoAvisoDraft(g.transbordoMetodoAviso);
          g.setTransbordoTelefonesDraft(g.getTransbordoPhonesForMethod(g.transbordoMetodoAviso, { preferQualificacao: true }));
        }
      }}
      title={draft === 'whatsapp' ? 'Configurar WhatsApp' : 'Configurar Roleta'}
      description="Escolha como a equipe deve ser avisada quando o transbordo de follow up acontecer."
      footer={
        <>
          <button type="button" className="wl-btn wl-btn--glass-ink" onClick={cancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="wl-btn wl-btn--lime"
            onClick={g.handleSaveTransbordoMetodoConfig}
            disabled={g.isSavingTransbordoMetodoConfig}
          >
            {g.isSavingTransbordoMetodoConfig ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <SegmentedChoice<'whatsapp' | 'roleta'>
        label="Método de aviso"
        value={draft}
        onChange={(next) => {
          g.setTransbordoMetodoAvisoDraft(next);
          g.setTransbordoTelefonesDraft(g.getTransbordoPhonesForMethod(next, { preferQualificacao: true }));
        }}
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'roleta', label: 'Roleta' },
        ]}
      />
      <PhoneListEditor phones={g.transbordoTelefonesDraft} onChange={g.setTransbordoTelefonesDraft} format={formatPhoneInput} keepOne />
    </GeraisDialog>
  );
};

export default TransbordoMetodoDialog;
