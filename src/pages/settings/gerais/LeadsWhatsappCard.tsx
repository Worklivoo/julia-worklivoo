import React from 'react';
import WhatsAppLogo from '../WhatsAppLogo';
import { Switch } from '@/components/ui/switch';
import type { GeraisCtx } from './useGerais';
import GeraisCard from './GeraisCard';
import StatusTag from './StatusTag';

/** Liga ou desliga o atendimento automático das mensagens que chegam direto no WhatsApp. */
const LeadsWhatsappCard = ({ g }: { g: GeraisCtx }) => (
  <GeraisCard
    id="ger-leads-whatsapp"
    icon={<WhatsAppLogo size={16} />}
    title="Leads WhatsApp"
    sub="Ativa o atendimento automático para mensagens recebidas no WhatsApp. Ao ativar essa funcionalidade, a IA irá realizar o atendimento com todos leads que chamarem diretamente no WhatsApp."
  >
    <div className="wl-set-box">
      <div className="wl-row">
        <div className="wl-kv">
          <span className="wl-label">Status</span>
          <StatusTag on={g.leadsWhatsappStatus === 'Ativado'} />
        </div>
        <Switch
          checked={g.leadsWhatsappStatus === 'Ativado'}
          onCheckedChange={g.handleToggleLeadsWhatsapp}
          disabled={g.isSavingLeadsWhatsapp}
          aria-label="Atendimento via WhatsApp"
          className="data-[state=checked]:bg-[var(--ink)]"
        />
      </div>
    </div>
  </GeraisCard>
);

export default LeadsWhatsappCard;
