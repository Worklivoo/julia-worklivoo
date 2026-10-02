import React from 'react';
import type { GeraisCtx } from './useGerais';
import { formatPhoneInline } from './phones';
import GeraisDialog, { SegmentedChoice } from './GeraisDialog';
import PhoneListEditor from './PhoneListEditor';

/** Distribuição de leads: escolhe WhatsApp (um número) ou Roleta (vários) e edita os telefones. */
const ReceiveMethodDialog = ({ g }: { g: GeraisCtx }) => {
  const isWhatsapp = g.receiveMethod === 'whatsapp';

  return (
    <GeraisDialog
      open={g.receiveMethodModalOpen}
      onOpenChange={g.setReceiveMethodModalOpen}
      title={isWhatsapp ? 'Configurar WhatsApp' : 'Configurar Roleta'}
      description={
        isWhatsapp
          ? 'Insira o número do WhatsApp para receber os leads.'
          : 'Insira os números de telefone, um por linha. Os leads serão distribuídos entre eles.'
      }
      footer={
        <button type="button" className="wl-btn wl-btn--lime" onClick={g.handleSaveReceiveMethod} disabled={g.isSavingReceiveMethod}>
          {g.isSavingReceiveMethod ? 'Salvando...' : 'Salvar preferência'}
        </button>
      }
    >
      <SegmentedChoice<'whatsapp' | 'roleta'>
        label="Método de distribuição"
        value={g.receiveMethod}
        onChange={g.setReceiveMethod}
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'roleta', label: 'Roleta' },
        ]}
      />
      {isWhatsapp ? (
        <PhoneListEditor phones={g.whatsappPhones} onChange={g.setWhatsappPhones} format={formatPhoneInline} />
      ) : (
        <PhoneListEditor phones={g.roletaPhones} onChange={g.setRoletaPhones} format={formatPhoneInline} />
      )}
    </GeraisDialog>
  );
};

export default ReceiveMethodDialog;
