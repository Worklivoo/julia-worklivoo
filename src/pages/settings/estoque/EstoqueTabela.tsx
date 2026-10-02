import React, { useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import type { EstoqueCtx } from './useEstoque';
import { CelulaLink, colunasComDados, colunasDe } from './colunas';
import '@/styles/worklivoo-lead.css';

/** Tabela do estoque com seleção, edição por linha e paginação. Rolagem horizontal também pela roda do mouse. */
const EstoqueTabela = ({ e }: { e: EstoqueCtx }) => {
  const kind = e.estoqueKind;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // A roda do mouse rola a tabela para o lado quando ela não cabe na largura (Shift ou rolagem lateral seguem normais).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (ev: WheelEvent) => {
      const target = scrollRef.current;
      if (!target) return;

      const canScrollX = target.scrollWidth > target.clientWidth + 1;
      if (!canScrollX) return;
      if (ev.shiftKey) return;
      if (Math.abs(ev.deltaX) > 0) return;
      if (Math.abs(ev.deltaY) === 0) return;

      if (ev.cancelable) ev.preventDefault();
      target.scrollLeft += ev.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as EventListener);
  }, []);

  if (!kind) return null;
  // Colunas sem nenhuma informação em todo o estoque (ex.: Portas) nem aparecem; basta uma linha com valor para a coluna surgir.
  const colunas = colunasComDados(colunasDe(kind), e.items);
  const { pagination } = e;
  const gerencia = e.canManageItems;
  const totalColunas = colunas.length + (gerencia ? 2 : 0);

  return (
    <div className="wl-estoque">
      <div ref={scrollRef} className="wl-tbl-wrap">
        <table className="wl-tbl">
          <thead>
            <tr>
              {gerencia && (
                <>
                  <th className="wl-estoque__check">
                    <input
                      type="checkbox"
                      className="wl-checkbox"
                      aria-label="Selecionar todos desta página"
                      checked={e.isAllPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = e.isSomePageSelected;
                      }}
                      onChange={e.toggleSelectPage}
                    />
                  </th>
                  <th className="wl-estoque__edit" aria-label="Editar" />
                </>
              )}
              {colunas.map((col) => (
                <th key={col.label} className={col.link ? 'wl-estoque__right' : undefined}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {e.loading ? (
              <tr><td colSpan={totalColunas} className="wl-estoque__msg">Carregando...</td></tr>
            ) : pagination.totalItems === 0 ? (
              <tr><td colSpan={totalColunas} className="wl-estoque__msg">Nenhum produto encontrado.</td></tr>
            ) : (
              pagination.pageItems.map((p) => (
                <tr key={String((p as any)?.uuid || (p as any)?.estoque_id || (p as any)?.imovel_id || (p as any)?.idx || Math.random())}>
                  {gerencia && (
                    <>
                      <td className="wl-estoque__check">
                        <input
                          type="checkbox"
                          className="wl-checkbox"
                          aria-label="Selecionar produto"
                          checked={p.uuid ? !!e.selectedIds[String(p.uuid)] : false}
                          disabled={!p.uuid}
                          onChange={() => p.uuid && e.toggleSelectOne(String(p.uuid))}
                        />
                      </td>
                      <td className="wl-estoque__edit">
                        <button
                          type="button"
                          className="wl-iconbtn"
                          aria-label="Editar produto"
                          title="Editar"
                          onClick={() => e.openEdit(p)}
                          disabled={e.isSyncing || e.deleting || !p.uuid}
                        >
                          <Pencil aria-hidden="true" />
                        </button>
                      </td>
                    </>
                  )}
                  {colunas.map((col) => (
                    <td key={col.label} className={col.link ? 'wl-estoque__right' : 'wl-estoque__cell'} title={col.title?.(p)}>
                      {col.link ? <CelulaLink href={col.link(p)} /> : col.texto?.(p)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalItems > 0 && (
        <div className="wl-pager">
          <p className="wl-pager__info">
            Mostrando <strong>{pagination.startIndex + 1}</strong>–<strong>{pagination.endIndex}</strong> de{' '}
            <strong>{pagination.totalItems}</strong>
          </p>
          <div className="wl-pager__nav">
            <button
              type="button"
              className="wl-btn wl-btn--glass wl-btn--sm"
              onClick={() => e.setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.currentPage <= 1}
            >
              Anterior
            </button>
            <span className="wl-pager__info">
              Página <strong>{pagination.currentPage}</strong> de <strong>{pagination.totalPages}</strong>
            </span>
            <button
              type="button"
              className="wl-btn wl-btn--glass wl-btn--sm"
              onClick={() => e.setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.currentPage >= pagination.totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueTabela;
