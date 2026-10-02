import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';

/** Casca dos diálogos da aba Gerais: título, descrição, corpo e rodapé de ações. */
const GeraisDialog = ({
  open,
  onOpenChange,
  title,
  description,
  size = 'sm',
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className={`wl-scope wl-modal wl-modal--${size}`}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <DialogHeader className="wl-modal__head">
        <DialogTitle className="wl-title wl-title--sm">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="wl-lede">{description}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{title}</DialogDescription>
        )}
      </DialogHeader>
      <div className="wl-modal__stack">{children}</div>
      {footer && <div className="wl-modal__foot wl-modal__foot--end">{footer}</div>}
    </DialogContent>
  </Dialog>
);

/** Alternador de duas opções (WhatsApp / Roleta etc.), no formato de abas segmentadas. */
export const SegmentedChoice = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) => (
  <div className="wl-tabs wl-segment" role="radiogroup" aria-label={label}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        role="radio"
        aria-checked={value === opt.value}
        className="wl-tab"
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export default GeraisDialog;
