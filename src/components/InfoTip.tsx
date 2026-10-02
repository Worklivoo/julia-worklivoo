import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';

interface InfoTipProps {
  /** Nome da métrica, usado no rótulo de acessibilidade. */
  label: string;
  /** Explicação de como o número é calculado. */
  children: React.ReactNode;
}

/**
 * Ícone "i" que explica uma métrica ao passar o mouse ou focar com o teclado.
 * Padrão Worklivoo: tooltip preto, texto branco, raio de 10px.
 */
const InfoTip = ({ label, children }: InfoTipProps) => (
  <Tooltip delayDuration={120}>
    <TooltipTrigger asChild>
      <button type="button" className="wl-scope wl-info" aria-label={`Como calculamos: ${label}`}>
        <Info aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" align="end" sideOffset={8} className="wl-scope wl-tip">
      {children}
    </TooltipContent>
  </Tooltip>
);

export default InfoTip;
