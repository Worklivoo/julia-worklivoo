import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-settings.css';

export interface SettingsTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}

/**
 * Barra de abas das Configurações. Quando as abas não cabem, a barra rola de lado:
 * pela roda do mouse (a rolagem vertical vira horizontal), pelas setas nas pontas
 * e automaticamente até a aba ativa. A barra de rolagem fica escondida.
 * Precisa estar dentro de <Tabs> (Radix).
 */
const SettingsTabsBar = ({ items, activeTab }: { items: SettingsTabItem[]; activeTab: string }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);

    // Roda do mouse: rolagem vertical anda a barra para o lado. Nas pontas, deixa a
    // página rolar normalmente (não "prende" o usuário na barra).
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const goingRight = e.deltaY > 0;
      if ((goingRight && el.scrollLeft >= max - 1) || (!goingRight && el.scrollLeft <= 0)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('scroll', updateArrows);
      el.removeEventListener('wheel', onWheel);
      observer.disconnect();
    };
  }, [updateArrows, items.length]);

  // Mantém a aba ativa visível (ex.: ao abrir por ?aba=estoque-de-produtos).
  useEffect(() => {
    const el = listRef.current;
    const active = el?.querySelector<HTMLElement>('[data-state="active"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [activeTab, items.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(200, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div className={`wl-tabsbar ${canScrollLeft ? 'has-left' : ''} ${canScrollRight ? 'has-right' : ''}`.trim()}>
      <button
        type="button"
        className="wl-tabsbar__arrow wl-tabsbar__arrow--left"
        aria-label="Ver abas anteriores"
        aria-hidden={!canScrollLeft}
        tabIndex={canScrollLeft ? 0 : -1}
        onClick={() => scrollByPage(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>

      <TabsPrimitive.List ref={listRef} className="wl-tabs wl-tabs--scroll" aria-label="Seções de configurações">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TabsPrimitive.Trigger key={item.id} value={item.id} className="wl-tab">
              <Icon />
              <span>{item.label}</span>
              {Boolean(item.highlight) && <span className="wl-tab__dot" aria-hidden="true" />}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      <button
        type="button"
        className="wl-tabsbar__arrow wl-tabsbar__arrow--right"
        aria-label="Ver mais abas"
        aria-hidden={!canScrollRight}
        tabIndex={canScrollRight ? 0 : -1}
        onClick={() => scrollByPage(1)}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
};

export default SettingsTabsBar;
