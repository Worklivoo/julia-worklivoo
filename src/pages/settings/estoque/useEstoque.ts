import { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { EstoqueItem, EstoqueKind, ProdutoCarro, ProdutoImobiliaria } from './helpers';
import { normalize, generateUniqueInt8Id, formatCurrencyDisplay, toPureNumberString } from './helpers';

/**
 * Estoque de produtos (carros ou imóveis, conforme o tipo da conta): carga, busca, paginação, seleção,
 * sincronização com a fonte de dados (5 min) e, para fonte INTERNA, cadastro, edição e exclusão.
 */
export const useEstoque = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EstoqueItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [syncingUntilMs, setSyncingUntilMs] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EstoqueItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    marca: string;
    modelo: string;
    ano_modelo: string;
    quilometragem: string;
    portas: string;
    combustivel: string;
    transmissao: string;
    cor: string;
    preco: string;
    descricao: string;
    itens_extras: string;
    link_do_carro: string;
  }>({
    marca: '',
    modelo: '',
    ano_modelo: '',
    quilometragem: '',
    portas: '',
    combustivel: '',
    transmissao: '',
    cor: '',
    preco: '',
    descricao: '',
    itens_extras: '',
    link_do_carro: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editImovelForm, setEditImovelForm] = useState<{
    imovel_titulo: string;
    imovel_transacao: string;
    imovel_propriedade: string;
    imovel_endereco: string;
    imovel_valor_venda: string;
    imovel_valor_aluguel: string;
    imovel_area: string;
    imovel_valor_condominio: string;
    imovel_valor_iptu: string;
    imovel_quartos: string;
    imovel_banheiros: string;
    imovel_vagas_garagem: string;
    imovel_descricao: string;
    imovel_caracteristicas: string;
    itens_extras: string;
    imovel_link: string;
  }>({
    imovel_titulo: '',
    imovel_transacao: '',
    imovel_propriedade: '',
    imovel_endereco: '',
    imovel_valor_venda: '',
    imovel_valor_aluguel: '',
    imovel_area: '',
    imovel_valor_condominio: '',
    imovel_valor_iptu: '',
    imovel_quartos: '',
    imovel_banheiros: '',
    imovel_vagas_garagem: '',
    imovel_descricao: '',
    imovel_caracteristicas: '',
    itens_extras: '',
    imovel_link: '',
  });
  const [addForm, setAddForm] = useState<{
    marca: string;
    modelo: string;
    ano_modelo: string;
    quilometragem: string;
    portas: string;
    combustivel: string;
    transmissao: string;
    cor: string;
    preco: string;
    descricao: string;
    itens_extras: string;
    link_do_carro: string;
  }>({
    marca: '',
    modelo: '',
    ano_modelo: '',
    quilometragem: '',
    portas: '',
    combustivel: '',
    transmissao: '',
    cor: '',
    preco: '',
    descricao: '',
    itens_extras: '',
    link_do_carro: '',
  });
  const [savingAdd, setSavingAdd] = useState(false);
  const [addImovelForm, setAddImovelForm] = useState<{
    imovel_titulo: string;
    imovel_transacao: string;
    imovel_propriedade: string;
    imovel_endereco: string;
    imovel_valor_venda: string;
    imovel_valor_aluguel: string;
    imovel_area: string;
    imovel_valor_condominio: string;
    imovel_valor_iptu: string;
    imovel_quartos: string;
    imovel_banheiros: string;
    imovel_vagas_garagem: string;
    imovel_descricao: string;
    imovel_caracteristicas: string;
    itens_extras: string;
    imovel_link: string;
  }>({
    imovel_titulo: '',
    imovel_transacao: '',
    imovel_propriedade: '',
    imovel_endereco: '',
    imovel_valor_venda: '',
    imovel_valor_aluguel: '',
    imovel_area: '',
    imovel_valor_condominio: '',
    imovel_valor_iptu: '',
    imovel_quartos: '',
    imovel_banheiros: '',
    imovel_vagas_garagem: '',
    imovel_descricao: '',
    imovel_caracteristicas: '',
    itens_extras: '',
    imovel_link: '',
  });

  const userIdForEstoque = user?.isMembro ? user?.user_id_empresa : user?.id;
  const userTipo = user?.tipo || '';
  const isTipoOutros = normalize(userTipo) === normalize('Outros');
  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (!user.isMembro) return true;
    return user.membro_tipo === 'Administrador';
  }, [user]);
  const estoqueKind: EstoqueKind | null =
    normalize(userTipo) === normalize('Loja de Carros')
      ? 'carro'
      : normalize(userTipo) === normalize('Imobiliaria')
        ? 'imovel'
        : null;
  const isSupportedTipo = estoqueKind !== null;
  const userIdForScrapperTipo = user?.isMembro ? user?.user_id_empresa : user?.id;
  const [scrapperTipo, setScrapperTipo] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!userIdForScrapperTipo) {
      setScrapperTipo(undefined);
      return;
    }
    let isActive = true;
    const run = async () => {
      const { data, error } = await supabase
        .from('usuarios_v2')
        .select('scrapper_tipo')
        .eq('user_id', userIdForScrapperTipo)
        .maybeSingle();

      if (!isActive) return;
      if (error) {
        setScrapperTipo(null);
        return;
      }
      setScrapperTipo((data as any)?.scrapper_tipo ?? null);
    };
    run();
    return () => {
      isActive = false;
    };
  }, [userIdForScrapperTipo]);

  const canManageItems = isAdmin && scrapperTipo !== undefined && normalize(scrapperTipo || '') === normalize('INTERNO');
  const shouldShowSyncButton =
    isAdmin && isSupportedTipo && scrapperTipo !== undefined && normalize(scrapperTipo || '') !== normalize('INTERNO');

  const syncStorageKey = useMemo(() => `settings-estoque-sync:${userIdForEstoque || 'unknown'}`, [userIdForEstoque]);
  const syncDurationMs = 5 * 60 * 1000;
  const isSyncing = syncingUntilMs !== null && Date.now() < syncingUntilMs;

  useEffect(() => {
    if (!canManageItems) {
      setSelectedIds({});
    }
  }, [canManageItems]);

  useEffect(() => {
    if (!userIdForEstoque) return;
    const raw = localStorage.getItem(syncStorageKey);
    if (!raw) {
      setSyncingUntilMs(null);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      localStorage.removeItem(syncStorageKey);
      setSyncingUntilMs(null);
      return;
    }
    if (Date.now() >= parsed) {
      localStorage.removeItem(syncStorageKey);
      setSyncingUntilMs(null);
      window.location.reload();
      return;
    }
    setSyncingUntilMs(parsed);
  }, [syncStorageKey, userIdForEstoque]);

  useEffect(() => {
    if (!syncingUntilMs) return;
    const remaining = syncingUntilMs - Date.now();
    if (remaining <= 0) return;
    const t = window.setTimeout(() => {
      localStorage.removeItem(syncStorageKey);
      setSyncingUntilMs(null);
      window.location.reload();
    }, remaining);
    return () => window.clearTimeout(t);
  }, [syncingUntilMs, syncStorageKey]);

  const handleSyncNow = async () => {
    if (!userIdForEstoque) {
      toast({ title: 'Erro', description: 'Usuário não identificado.' });
      return;
    }
    if (!isSupportedTipo) {
      toast({ title: 'Indisponível', description: 'Sincronização indisponível para este tipo de usuário.' });
      return;
    }
    if (normalize(scrapperTipo || '') === normalize('INTERNO')) {
      toast({ title: 'Indisponível', description: 'Sincronização desabilitada para este tipo de scrapper.' });
      return;
    }

    const webhookUrl =
      estoqueKind === 'imovel'
        ? 'https://primary-production-d442.up.railway.app/webhook/7db085f5-1f3b-4437-ae7d-6986322da4b4'
        : 'https://primary-production-d442.up.railway.app/webhook/nfdbgfdj996banco-dados-135b490d';
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userIdForEstoque }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({ title: 'Erro ao sincronizar', description: text || `Status ${res.status}` });
        return;
      }
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err?.message || 'Falha ao enviar webhook.' });
      return;
    }

    const until = Date.now() + syncDurationMs;
    localStorage.setItem(syncStorageKey, String(until));
    setSyncingUntilMs(until);
  };

  const load = async () => {
    if (!userIdForEstoque) return;
    if (!isSupportedTipo) return;
    if (isSyncing) return;
    setLoading(true);
    const query =
      estoqueKind === 'carro'
        ? supabase
            .from('produto_carro_v2')
            .select(
              'estoque_id,marca,modelo,quilometragem,ano_modelo,portas,combustivel,transmissao,cor,preco,descricao,itens_extras,link_do_carro,user_id,status_atualizacao,atualizado_em,uuid'
            )
            .eq('user_id', userIdForEstoque)
            .order('atualizado_em', { ascending: false })
            .order('estoque_id', { ascending: false })
        : supabase
            .from('produto_imobiliaria_v2')
            .select(
              'imovel_id,imovel_titulo,imovel_transacao,imovel_propriedade,imovel_endereco,imovel_valor_venda,imovel_valor_aluguel,imovel_area,imovel_valor_condominio,imovel_valor_iptu,imovel_quartos,imovel_banheiros,imovel_vagas_garagem,imovel_descricao,imovel_caracteristicas,itens_extras,imovel_link,created_at,atualizado_em,user_id,uuid'
            )
            .eq('user_id', userIdForEstoque)
            .order('atualizado_em', { ascending: false })
            .order('imovel_id', { ascending: false });
    const { data, error } = await query;
    setLoading(false);

    if (error) {
      setItems([]);
      toast({
        title: 'Erro ao carregar estoque',
        description: (error as any)?.message || (error as any)?.details || 'Não foi possível buscar os produtos.',
      });
      return;
    }

    setItems((data ?? []) as EstoqueItem[]);
  };

  useEffect(() => {
    if (isSyncing) return;
    load();
  }, [userIdForEstoque, userTipo, isSyncing]);

  useEffect(() => {
    setPage(1);
  }, [search, userIdForEstoque]);

  useEffect(() => {
    setSelectedIds({});
    setDeleteOpen(false);
  }, [userIdForEstoque]);


  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return items;
    return items.filter((p) => {
      const haystack =
        estoqueKind === 'carro'
          ? [
              (p as ProdutoCarro).marca,
              (p as ProdutoCarro).modelo,
              (p as ProdutoCarro).ano_modelo,
              (p as ProdutoCarro).combustivel,
              (p as ProdutoCarro).transmissao,
              (p as ProdutoCarro).cor,
              (p as ProdutoCarro).preco,
              (p as ProdutoCarro).descricao,
              (p as ProdutoCarro).itens_extras,
            ]
              .map((v) => normalize(v))
              .join(' ')
          : [
              (p as ProdutoImobiliaria).imovel_titulo,
              (p as ProdutoImobiliaria).imovel_transacao,
              (p as ProdutoImobiliaria).imovel_propriedade,
              (p as ProdutoImobiliaria).imovel_endereco,
              (p as ProdutoImobiliaria).imovel_valor_venda,
              (p as ProdutoImobiliaria).imovel_valor_aluguel,
              (p as ProdutoImobiliaria).imovel_area,
              (p as ProdutoImobiliaria).imovel_valor_condominio,
              (p as ProdutoImobiliaria).imovel_valor_iptu,
              (p as ProdutoImobiliaria).imovel_descricao,
              (p as ProdutoImobiliaria).imovel_caracteristicas,
            ]
              .map((v) => normalize(v))
              .join(' ');
      return haystack.includes(q);
    });
  }, [items, search]);

  const pagination = useMemo(() => {
    const pageSize = 10;
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageItems = filtered.slice(startIndex, endIndex);
    return { pageSize, totalItems, totalPages, currentPage, startIndex, endIndex, pageItems };
  }, [filtered, page]);

  const baseColumnCount = useMemo(() => {
    return estoqueKind === 'carro' ? 11 : 14;
  }, [estoqueKind]);

  const selectedCount = useMemo(() => Object.keys(selectedIds).length, [selectedIds]);

  const pageSelectableIds = useMemo(() => {
    return pagination.pageItems
      .map((p) => (p.uuid ? String(p.uuid) : ''))
      .filter(Boolean);
  }, [pagination.pageItems]);

  const isAllPageSelected = useMemo(() => {
    if (pageSelectableIds.length === 0) return false;
    return pageSelectableIds.every((id) => !!selectedIds[id]);
  }, [pageSelectableIds, selectedIds]);

  const isSomePageSelected = useMemo(() => {
    if (pageSelectableIds.length === 0) return false;
    return pageSelectableIds.some((id) => !!selectedIds[id]) && !isAllPageSelected;
  }, [pageSelectableIds, selectedIds, isAllPageSelected]);

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const toggleSelectPage = () => {
    if (pageSelectableIds.length === 0) return;
    setSelectedIds((prev) => {
      const next = { ...prev };
      const allSelected = pageSelectableIds.every((id) => !!next[id]);
      if (allSelected) {
        pageSelectableIds.forEach((id) => {
          delete next[id];
        });
        return next;
      }
      pageSelectableIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  };

  const handleConfirmDeleteSelected = async () => {
    if (!userIdForEstoque) {
      toast({ title: 'Erro', description: 'Usuário não identificado.' });
      return;
    }
    if (!isSupportedTipo) {
      toast({ title: 'Indisponível', description: 'Ação indisponível para este tipo de usuário.' });
      return;
    }
    const ids = Object.keys(selectedIds);
    if (ids.length === 0) {
      setDeleteOpen(false);
      return;
    }
    setDeleting(true);
    const { error } =
      estoqueKind === 'carro'
        ? await supabase.from('produto_carro_v2').delete().eq('user_id', userIdForEstoque).in('uuid', ids)
        : await supabase.from('produto_imobiliaria_v2').delete().eq('user_id', userIdForEstoque).in('uuid', ids);
    setDeleting(false);

    if (error) {
      toast({ title: 'Erro ao excluir', description: (error as any)?.message || 'Não foi possível excluir os itens.' });
      return;
    }

    const idSet: Record<string, true> = {};
    ids.forEach((id) => {
      idSet[id] = true;
    });
    setItems((prev) => prev.filter((p) => !p.uuid || !idSet[String(p.uuid)]));
    setSelectedIds({});
    setDeleteOpen(false);
    toast({ title: 'Excluído', description: 'Itens removidos com sucesso.' });
  };

  const openEdit = (p: EstoqueItem) => {
    if (!p.uuid) {
      toast({ title: 'Erro', description: 'Este item não possui identificador para edição.' });
      return;
    }
    setEditing(p);
    if (estoqueKind === 'carro') {
      const c = p as ProdutoCarro;
      setEditForm({
        marca: String(c.marca ?? ''),
        modelo: String(c.modelo ?? ''),
        ano_modelo: String(c.ano_modelo ?? ''),
        quilometragem: String(c.quilometragem ?? ''),
        portas: String(c.portas ?? ''),
        combustivel: String(c.combustivel ?? ''),
        transmissao: String(c.transmissao ?? ''),
        cor: String(c.cor ?? ''),
        preco: String(c.preco ?? ''),
        descricao: String(c.descricao ?? ''),
        itens_extras: String(c.itens_extras ?? ''),
        link_do_carro: String(c.link_do_carro ?? ''),
      });
    } else if (estoqueKind === 'imovel') {
      const i = p as ProdutoImobiliaria;
      setEditImovelForm({
        imovel_titulo: String(i.imovel_titulo ?? ''),
        imovel_transacao: String(i.imovel_transacao ?? ''),
        imovel_propriedade: String(i.imovel_propriedade ?? ''),
        imovel_endereco: String(i.imovel_endereco ?? ''),
        imovel_valor_venda: String(i.imovel_valor_venda ?? ''),
        imovel_valor_aluguel: String(i.imovel_valor_aluguel ?? ''),
        imovel_area: String(i.imovel_area ?? ''),
        imovel_valor_condominio: String(i.imovel_valor_condominio ?? ''),
        imovel_valor_iptu: String(i.imovel_valor_iptu ?? ''),
        imovel_quartos: String(i.imovel_quartos ?? ''),
        imovel_banheiros: String(i.imovel_banheiros ?? ''),
        imovel_vagas_garagem: String(i.imovel_vagas_garagem ?? ''),
        imovel_descricao: String(i.imovel_descricao ?? ''),
        imovel_caracteristicas: String(i.imovel_caracteristicas ?? ''),
        itens_extras: String(i.itens_extras ?? ''),
        imovel_link: String(i.imovel_link ?? ''),
      });
    }
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!userIdForEstoque) {
      toast({ title: 'Erro', description: 'Usuário não identificado.' });
      return;
    }
    if (!isSupportedTipo) {
      toast({ title: 'Indisponível', description: 'Ação indisponível para este tipo de usuário.' });
      return;
    }
    if (!editing?.uuid) {
      toast({ title: 'Erro', description: 'Item não identificado.' });
      return;
    }
    setSavingEdit(true);
    const toIntOrNull = (v: string) => {
      const raw = String(v ?? '').trim();
      if (!raw) return null;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    };
    const payload =
      estoqueKind === 'carro'
        ? {
            marca: editForm.marca,
            modelo: editForm.modelo,
            ano_modelo: editForm.ano_modelo,
            quilometragem: toPureNumberString(editForm.quilometragem),
            portas: toPureNumberString(editForm.portas),
            combustivel: editForm.combustivel,
            transmissao: editForm.transmissao,
            cor: editForm.cor,
            preco: formatCurrencyDisplay(editForm.preco) || editForm.preco,
            descricao: editForm.descricao,
            itens_extras: editForm.itens_extras,
            link_do_carro: editForm.link_do_carro,
          }
        : {
            imovel_titulo: editImovelForm.imovel_titulo,
            imovel_transacao: editImovelForm.imovel_transacao,
            imovel_propriedade: editImovelForm.imovel_propriedade,
            imovel_endereco: editImovelForm.imovel_endereco,
            imovel_valor_venda: formatCurrencyDisplay(editImovelForm.imovel_valor_venda) || editImovelForm.imovel_valor_venda,
            imovel_valor_aluguel: formatCurrencyDisplay(editImovelForm.imovel_valor_aluguel) || editImovelForm.imovel_valor_aluguel,
            imovel_area: toPureNumberString(editImovelForm.imovel_area),
            imovel_valor_condominio: formatCurrencyDisplay(editImovelForm.imovel_valor_condominio) || editImovelForm.imovel_valor_condominio,
            imovel_valor_iptu: formatCurrencyDisplay(editImovelForm.imovel_valor_iptu) || editImovelForm.imovel_valor_iptu,
            imovel_quartos: toIntOrNull(editImovelForm.imovel_quartos),
            imovel_banheiros: toIntOrNull(editImovelForm.imovel_banheiros),
            imovel_vagas_garagem: toIntOrNull(editImovelForm.imovel_vagas_garagem),
            imovel_descricao: editImovelForm.imovel_descricao,
            imovel_caracteristicas: editImovelForm.imovel_caracteristicas,
            itens_extras: editImovelForm.itens_extras,
            imovel_link: editImovelForm.imovel_link,
          };

    const { data, error } =
      estoqueKind === 'carro'
        ? await supabase
            .from('produto_carro_v2')
            .update(payload as any)
            .eq('user_id', userIdForEstoque)
            .eq('uuid', String(editing.uuid))
            .select(
              'uuid,marca,modelo,ano_modelo,quilometragem,portas,combustivel,transmissao,cor,preco,descricao,itens_extras,link_do_carro'
            )
            .single()
        : await supabase
            .from('produto_imobiliaria_v2')
            .update(payload as any)
            .eq('user_id', userIdForEstoque)
            .eq('uuid', String(editing.uuid))
            .select(
              'uuid,imovel_id,imovel_titulo,imovel_transacao,imovel_propriedade,imovel_endereco,imovel_valor_venda,imovel_valor_aluguel,imovel_area,imovel_valor_condominio,imovel_valor_iptu,imovel_quartos,imovel_banheiros,imovel_vagas_garagem,imovel_descricao,imovel_caracteristicas,itens_extras,imovel_link,created_at,atualizado_em,user_id'
            )
            .single();

    setSavingEdit(false);

    if (error) {
      toast({ title: 'Erro ao salvar', description: (error as any)?.message || 'Não foi possível salvar as alterações.' });
      return;
    }

    const updated = (data ?? payload) as EstoqueItem;
    setItems((prev) =>
      prev.map((it) => (it.uuid && String(it.uuid) === String(editing.uuid) ? { ...it, ...updated } : it))
    );
    setEditOpen(false);
    setEditing(null);
    toast({ title: 'Atualizado', description: 'Produto atualizado com sucesso.' });
  };

  const handleCreateNew = async () => {
    if (!userIdForEstoque) {
      toast({ title: 'Erro', description: 'Usuário não identificado.' });
      return;
    }
    if (!isSupportedTipo) {
      toast({ title: 'Indisponível', description: 'Cadastro indisponível para este tipo de usuário.' });
      return;
    }
    setSavingAdd(true);
    const toIntOrNull = (v: string) => {
      const raw = String(v ?? '').trim();
      if (!raw) return null;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    };
    const uniqueId =
      estoqueKind === 'carro'
        ? await generateUniqueInt8Id('produto_carro_v2', 'estoque_id')
        : await generateUniqueInt8Id('produto_imobiliaria_v2', 'imovel_id');
    const payload =
      estoqueKind === 'carro'
        ? {
            user_id: userIdForEstoque,
            estoque_id: uniqueId,
            marca: addForm.marca,
            modelo: addForm.modelo,
            ano_modelo: addForm.ano_modelo,
            quilometragem: toPureNumberString(addForm.quilometragem),
            portas: toPureNumberString(addForm.portas),
            combustivel: addForm.combustivel,
            transmissao: addForm.transmissao,
            cor: addForm.cor,
            preco: formatCurrencyDisplay(addForm.preco) || addForm.preco,
            descricao: addForm.descricao,
            itens_extras: addForm.itens_extras,
            link_do_carro: addForm.link_do_carro,
          }
        : {
            user_id: userIdForEstoque,
            imovel_id: uniqueId,
            imovel_titulo: addImovelForm.imovel_titulo,
            imovel_transacao: addImovelForm.imovel_transacao,
            imovel_propriedade: addImovelForm.imovel_propriedade,
            imovel_endereco: addImovelForm.imovel_endereco,
            imovel_valor_venda: formatCurrencyDisplay(addImovelForm.imovel_valor_venda) || addImovelForm.imovel_valor_venda,
            imovel_valor_aluguel: formatCurrencyDisplay(addImovelForm.imovel_valor_aluguel) || addImovelForm.imovel_valor_aluguel,
            imovel_area: toPureNumberString(addImovelForm.imovel_area),
            imovel_valor_condominio: formatCurrencyDisplay(addImovelForm.imovel_valor_condominio) || addImovelForm.imovel_valor_condominio,
            imovel_valor_iptu: formatCurrencyDisplay(addImovelForm.imovel_valor_iptu) || addImovelForm.imovel_valor_iptu,
            imovel_quartos: toIntOrNull(addImovelForm.imovel_quartos),
            imovel_banheiros: toIntOrNull(addImovelForm.imovel_banheiros),
            imovel_vagas_garagem: toIntOrNull(addImovelForm.imovel_vagas_garagem),
            imovel_descricao: addImovelForm.imovel_descricao,
            imovel_caracteristicas: addImovelForm.imovel_caracteristicas,
            itens_extras: addImovelForm.itens_extras,
            imovel_link: addImovelForm.imovel_link,
          };

    const { data, error } =
      estoqueKind === 'carro'
        ? await supabase
            .from('produto_carro_v2')
            .insert(payload as any)
            .select(
              'uuid,marca,modelo,ano_modelo,quilometragem,portas,combustivel,transmissao,cor,preco,descricao,itens_extras,link_do_carro,user_id'
            )
            .single()
        : await supabase
            .from('produto_imobiliaria_v2')
            .insert(payload as any)
            .select(
              'uuid,imovel_id,imovel_titulo,imovel_transacao,imovel_propriedade,imovel_endereco,imovel_valor_venda,imovel_valor_aluguel,imovel_area,imovel_valor_condominio,imovel_valor_iptu,imovel_quartos,imovel_banheiros,imovel_vagas_garagem,imovel_descricao,imovel_caracteristicas,itens_extras,imovel_link,created_at,atualizado_em,user_id'
            )
            .single();

    setSavingAdd(false);

    if (error) {
      toast({ title: 'Erro ao adicionar', description: (error as any)?.message || 'Não foi possível adicionar o produto.' });
      return;
    }

    const created = (data ?? payload) as EstoqueItem;
    setItems((prev) => [created, ...prev]);
    setAddOpen(false);
    if (estoqueKind === 'carro') {
      setAddForm({
        marca: '',
        modelo: '',
        ano_modelo: '',
        quilometragem: '',
        portas: '',
        combustivel: '',
        transmissao: '',
        cor: '',
        preco: '',
        descricao: '',
        itens_extras: '',
        link_do_carro: '',
      });
    } else {
      setAddImovelForm({
        imovel_titulo: '',
        imovel_transacao: '',
        imovel_propriedade: '',
        imovel_endereco: '',
        imovel_valor_venda: '',
        imovel_valor_aluguel: '',
        imovel_area: '',
        imovel_valor_condominio: '',
        imovel_valor_iptu: '',
        imovel_quartos: '',
        imovel_banheiros: '',
        imovel_vagas_garagem: '',
        imovel_descricao: '',
        imovel_caracteristicas: '',
        itens_extras: '',
        imovel_link: '',
      });
    }
    toast({ title: 'Adicionado', description: 'Produto adicionado com sucesso.' });
  };

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  const stats = useMemo(() => {
    const total = items.length;
    const lastUpdated = items
      .map((i) => (i as any)?.atualizado_em)
      .filter(Boolean)
      .map((v) => String(v))
      .sort()
      .at(-1);
    return { total, lastUpdated };
  }, [items]);

  return {
    loading,
    setLoading,
    items,
    setItems,
    search,
    setSearch,
    page,
    setPage,
    syncingUntilMs,
    setSyncingUntilMs,
    selectedIds,
    setSelectedIds,
    deleteOpen,
    setDeleteOpen,
    deleting,
    setDeleting,
    editOpen,
    setEditOpen,
    editing,
    setEditing,
    addOpen,
    setAddOpen,
    editForm,
    setEditForm,
    savingEdit,
    setSavingEdit,
    editImovelForm,
    setEditImovelForm,
    addForm,
    setAddForm,
    savingAdd,
    setSavingAdd,
    addImovelForm,
    setAddImovelForm,
    userIdForEstoque,
    userTipo,
    isTipoOutros,
    isAdmin,
    isSupportedTipo,
    userIdForScrapperTipo,
    scrapperTipo,
    setScrapperTipo,
    canManageItems,
    syncStorageKey,
    syncDurationMs,
    isSyncing,
    handleSyncNow,
    load,
    filtered,
    pagination,
    baseColumnCount,
    selectedCount,
    pageSelectableIds,
    isAllPageSelected,
    isSomePageSelected,
    toggleSelectOne,
    toggleSelectPage,
    handleConfirmDeleteSelected,
    openEdit,
    handleSaveEdit,
    handleCreateNew,
    stats,
    estoqueKind,
    shouldShowSyncButton,
  };
};

export type EstoqueCtx = ReturnType<typeof useEstoque>;
