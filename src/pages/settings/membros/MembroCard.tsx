import React from 'react';
import { MoreVertical, Pencil, Trash2, User, UserCircle, UserX } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatPhone } from '@/lib/lead-detail-utils';
import type { Membro } from '@/lib/membros';
import type { MembrosCtx } from './useMembros';
import { getInitials } from './phones';

/** Cartão de um membro da equipe, com o menu de ações (só aparece para quem pode gerenciar a equipe). */
const MembroCard = ({ membro, m }: { membro: Membro; m: MembrosCtx }) => {
  const busy = Boolean(m.actionLoading?.includes(membro.membro_id));
  const off = membro.membro_status === 'Desativado';

  return (
    <article className={`wl-member${off ? ' is-off' : ''}`}>
      <div className="wl-member__top">
        <span className="wl-avatar wl-avatar--lg" aria-hidden="true">{getInitials(membro.membro_nome)}</span>
        <div className="wl-member__id">
          <h4 className="wl-member__name">{membro.membro_nome}</h4>
          <p className="wl-member__line">{membro.membro_email}</p>
          {membro.membro_telefone && <p className="wl-member__line">{formatPhone(membro.membro_telefone)}</p>}
        </div>

        {m.canAddMembers() && (
          <DropdownMenu
            open={m.openMenuId === membro.membro_id}
            onOpenChange={(open) => m.setOpenMenuId(open ? membro.membro_id : null)}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="wl-iconbtn"
                aria-label={`Ações de ${membro.membro_nome}`}
                disabled={busy}
              >
                <MoreVertical aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="wl-scope wl-menu w-52">
              <DropdownMenuItem
                className="wl-menu__item"
                disabled={busy}
                onSelect={(e) => {
                  e.preventDefault();
                  m.handleSendResetPasswordLink(membro);
                }}
              >
                <UserCircle aria-hidden="true" />
                Redefinir senha
              </DropdownMenuItem>
              <DropdownMenuItem
                className="wl-menu__item"
                onSelect={(e) => {
                  e.preventDefault();
                  m.openEditMemberDialog(membro);
                }}
              >
                <Pencil aria-hidden="true" />
                Editar informações
              </DropdownMenuItem>
              {membro.membro_status === 'Ativado' ? (
                <DropdownMenuItem
                  className="wl-menu__item"
                  disabled={busy}
                  onSelect={(e) => {
                    e.preventDefault();
                    m.setOpenMenuId(null);
                    m.setDeactivateAlert({ open: true, membro });
                  }}
                >
                  <UserX aria-hidden="true" />
                  Desativar membro
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="wl-menu__item"
                  disabled={busy}
                  onSelect={(e) => {
                    e.preventDefault();
                    m.setOpenMenuId(null);
                    m.handleReactivateMembro(membro);
                  }}
                >
                  <User aria-hidden="true" />
                  Reativar membro
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="wl-menu__item wl-menu__item--danger"
                disabled={busy}
                onSelect={(e) => {
                  e.preventDefault();
                  m.setOpenMenuId(null);
                  m.setDeleteAlert({ open: true, membro });
                }}
              >
                <Trash2 aria-hidden="true" />
                Excluir membro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {off && (
        <div className="wl-pillrow">
          <span className="wl-tag wl-tag--idle">Desativado</span>
        </div>
      )}
    </article>
  );
};

export default MembroCard;
