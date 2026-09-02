import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/contexts/CRMContext';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Package, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

type ProdutoCarro = {
  idx?: number | null;
  estoque_id?: number | null;
  marca?: string | null;
  modelo?: string | null;
  quilometragem?: string | null;
  ano_modelo?: string | null;
  portas?: string | null;
  combustivel?: string | null;
  transmissao?: string | null;
  cor?: string | null;
  preco?: string | null;
  descricao?: string | null;
  itens_extras?: string | null;
  link_do_carro?: string | null;
  user_id?: string | null;
  status_atualizacao?: string | null;
  atualizado_em?: string | null;
  uuid?: string | null;
};

type ProdutoImobiliaria = {
  idx?: number | null;
  imovel_titulo?: string | null;
  imovel_transacao?: string | null;
  imovel_propriedade?: string | null;
  imovel_descricao?: string | null;
  imovel_endereco?: string | null;
  imovel_link?: string | null;
  imovel_valor_venda?: string | number | null;
  imovel_valor_aluguel?: string | number | null;
  imovel_area?: string | number | null;
  imovel_valor_condominio?: string | number | null;
  imovel_valor_iptu?: string | number | null;
  imovel_quartos?: number | null;
  imovel_banheiros?: number | null;
  imovel_vagas_garagem?: number | null;
  imovel_caracteristicas?: string | null;
  itens_extras?: string | null;
  created_at?: string | null;
  atualizado_em?: string | null;
  imovel_id?: number | null;
  user_id?: string | null;
  uuid?: string | null;
};

type EstoqueKind = 'carro' | 'imovel';
type EstoqueItem = ProdutoCarro | ProdutoImobiliaria;

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR');
};

const sanitizeLink = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const noWrapTicks = raw.replace(/^\s*`+/, '').replace(/`+\s*$/, '').trim();
  return noWrapTicks;
};

const toCellText = (value: unknown) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const v = value.trim();
    return v ? v : '-';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const asJson = JSON.stringify(value);
    return asJson && asJson !== '{}' ? asJson : '-';
  } catch {
    return String(value);
  }
};

const toTitleText = (value: unknown) => {
  const text = toCellText(value);
  return text === '-' ? undefined : text;
};

const generateRandomInt8 = () => {
  const min = 1n;
  const max = 9223372036854775807n;
  const range = max - min + 1n;
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  let randomBigInt = 0n;
  for (let i = 0; i < 8; i++) {
    randomBigInt = (randomBigInt << 8n) | BigInt(randomBytes[i]);
  }
  const result = min + (randomBigInt % range);
  return Number(result);
};

const generateUniqueInt8Id = async (
  table: 'produto_carro_v2' | 'produto_imobiliaria_v2',
  idColumn: 'estoque_id' | 'imovel_id',
  userId: string
): Promise<number> => {
  let attempts = 0;
  const maxAttempts = 20;
  while (attempts < maxAttempts) {
    const candidate = generateRandomInt8();
    const { data, error } = await supabase
      .from(table)
      .select(idColumn)
      .eq(idColumn, candidate)
      .maybeSingle();
    if (!error && !data) {
      return candidate;
    }
    attempts++;
  }
  const fallback = Math.floor(Date.now() * 1000 + Math.random() * 1000000);
  return fallback;
};

const formatCurrencyDisplay = (value: unknown): string => {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (!raw) return '';
  const numeric = Number(raw) / 100;
  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

const formatThousandsDisplay = (value: unknown): string => {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (!raw) return '';
  return Number(raw).toLocaleString('pt-BR');
};

const toPureNumberString = (value: unknown): string => {
  return String(value ?? '').replace(/\D/g, '');
};

const EstoqueDeProdutosTab = () => {
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
  const colClass = 'w-[220px] min-w-[220px] max-w-[220px]';
  const linkColClass = 'w-[260px] min-w-[260px] max-w-[260px]';
  const tableMinWClass = 'min-w-[2680px]';
  const checkboxColClass = 'w-[44px] min-w-[44px] max-w-[44px]';
  const editColClass = 'w-[52px] min-w-[52px] max-w-[52px]';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const target = scrollRef.current;
      if (!target) return;

      const canScrollX = target.scrollWidth > target.clientWidth + 1;
      if (!canScrollX) return;
      if (e.shiftKey) return;
      if (Math.abs(e.deltaX) > 0) return;
      if (Math.abs(e.deltaY) === 0) return;

      if (e.cancelable) e.preventDefault();
      target.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as EventListener);
  }, []);

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
        ? await generateUniqueInt8Id('produto_carro_v2', 'estoque_id', userIdForEstoque)
        : await generateUniqueInt8Id('produto_imobiliaria_v2', 'imovel_id', userIdForEstoque);
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

  return (
    <div className="grid gap-5">
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm min-w-0 max-w-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">Estoque de Produtos</CardTitle>
                  <Badge variant="outline">{userTipo || '-'}</Badge>
                </div>
              </div>
            </div>

            {!isSupportedTipo && !isTipoOutros ? (
              <div className="text-sm text-muted-foreground">
                Disponível apenas para <span className="font-medium">Loja de Carros</span> ou{' '}
                <span className="font-medium">Imobiliaria</span>.
              </div>
            ) : shouldShowSyncButton ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="rounded-xl"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sincronizar Agora</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Total: <span className="text-foreground font-medium">{stats.total}</span></span>
            <span>•</span>
            <span>Última atualização: <span className="text-foreground font-medium">{formatTimestamp(stats.lastUpdated ?? null)}</span></span>
          </div>

          {isSyncing ? (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-8">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <RefreshCw className="h-10 w-10 animate-spin" />
                <div className="text-sm text-muted-foreground">
                  Sincronizando estoque... aguarde até 5 minutos.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      !isSupportedTipo || isTipoOutros
                        ? 'Buscar...'
                        : estoqueKind === 'carro'
                          ? 'Buscar por marca, modelo, ano, combustível, cor, preço, descrição ou itens extras...'
                          : 'Buscar por título, transação, propriedade, endereço, valores, descrição ou itens extras...'
                    }
                    className="bg-background"
                    disabled={!isSupportedTipo}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  {canManageItems ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl gap-2"
                        onClick={() => setAddOpen(true)}
                        disabled={!isSupportedTipo || isSyncing}
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-9 rounded-xl gap-2"
                        disabled={selectedCount === 0}
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {isSupportedTipo && (
                <div className="rounded-xl border border-border/50 shadow-sm overflow-hidden min-w-0 max-w-full">
                  <div
                    ref={scrollRef}
                    className="estoque-scroll w-full max-w-full min-w-0 overflow-x-scroll overflow-y-hidden pr-4"
                  >
                    <table
                      className={`${estoqueKind === 'carro' ? tableMinWClass : 'min-w-[3440px]'} table-fixed w-full caption-bottom text-sm`}
                    >
                      <TableHeader>
                        <TableRow>
                          {canManageItems ? (
                            <>
                              <TableHead className={`${checkboxColClass} whitespace-nowrap`}>
                                <input
                                  type="checkbox"
                                  checked={isAllPageSelected}
                                  ref={(el) => {
                                    if (el) el.indeterminate = isSomePageSelected;
                                  }}
                                  onChange={toggleSelectPage}
                                  className="h-4 w-4 rounded border border-input bg-background accent-black"
                                />
                              </TableHead>
                              <TableHead className={`${editColClass} whitespace-nowrap`}></TableHead>
                            </>
                          ) : null}
                          {estoqueKind === 'carro' ? (
                            <>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Marca</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Modelo</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Ano</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>KM</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Portas</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Combustível</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Transmissão</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Cor</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Preço</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Descrição</TableHead>
                              <TableHead className={`${linkColClass} whitespace-nowrap text-right`}>Link</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Título</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Transação</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Propriedade</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Endereço</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Valor venda</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Valor aluguel</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Área</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Condomínio</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>IPTU</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Quartos</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Banheiros</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Vagas</TableHead>
                              <TableHead className={`${colClass} whitespace-nowrap`}>Descrição</TableHead>
                              <TableHead className={`${linkColClass} whitespace-nowrap text-right`}>Link</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell
                              colSpan={baseColumnCount + (canManageItems ? 2 : 0)}
                              className="text-sm text-muted-foreground"
                            >
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : pagination.totalItems === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={baseColumnCount + (canManageItems ? 2 : 0)}
                              className="text-sm text-muted-foreground"
                            >
                              Nenhum produto encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pagination.pageItems.map((p) => (
                            <TableRow key={String((p as any)?.uuid || (p as any)?.estoque_id || (p as any)?.imovel_id || (p as any)?.idx || Math.random())}>
                              {canManageItems ? (
                                <>
                                  <TableCell className={`${checkboxColClass} whitespace-nowrap`}>
                                    <input
                                      type="checkbox"
                                      checked={p.uuid ? !!selectedIds[String(p.uuid)] : false}
                                      disabled={!p.uuid}
                                      onChange={() => p.uuid && toggleSelectOne(String(p.uuid))}
                                      className="h-4 w-4 rounded border border-input bg-background accent-black disabled:opacity-40"
                                    />
                                  </TableCell>
                                  <TableCell className={`${editColClass} whitespace-nowrap`}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 rounded-xl"
                                          onClick={() => openEdit(p)}
                                          disabled={isSyncing || deleting || !p.uuid}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Editar</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                </>
                              ) : null}
                              {estoqueKind === 'carro' ? (
                                <>
                                  <TableCell
                                    className={`${colClass} whitespace-nowrap truncate`}
                                    title={(p as ProdutoCarro).marca ?? undefined}
                                  >
                                    {(p as ProdutoCarro).marca || '-'}
                                  </TableCell>
                                  <TableCell
                                    className={`${colClass} whitespace-nowrap truncate`}
                                    title={(p as ProdutoCarro).modelo ?? undefined}
                                  >
                                    {(p as ProdutoCarro).modelo || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).ano_modelo || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).quilometragem || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).portas || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).combustivel || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).transmissao || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).cor || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoCarro).preco || '-'}
                                  </TableCell>
                                  <TableCell
                                    className={`${colClass} whitespace-nowrap truncate`}
                                    title={toTitleText((p as ProdutoCarro).descricao)}
                                  >
                                    {toCellText((p as ProdutoCarro).descricao)}
                                  </TableCell>
                                  <TableCell className={`${linkColClass} whitespace-nowrap text-right`}>
                                    {sanitizeLink((p as ProdutoCarro).link_do_carro) ? (
                                      <a
                                        href={sanitizeLink((p as ProdutoCarro).link_do_carro)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-end gap-1 text-sm text-black hover:underline"
                                      >
                                        Abrir <ExternalLink className="h-4 w-4" />
                                      </a>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell
                                    className={`${colClass} whitespace-nowrap truncate`}
                                    title={toTitleText((p as ProdutoImobiliaria).imovel_titulo)}
                                  >
                                    {toCellText((p as ProdutoImobiliaria).imovel_titulo)}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoImobiliaria).imovel_transacao || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {(p as ProdutoImobiliaria).imovel_propriedade || '-'}
                                  </TableCell>
                                  <TableCell
                                    className={`${colClass} whitespace-nowrap truncate`}
                                    title={toTitleText((p as ProdutoImobiliaria).imovel_endereco)}
                                  >
                                    {toCellText((p as ProdutoImobiliaria).imovel_endereco)}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_valor_venda ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_valor_aluguel ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_area ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_valor_condominio ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_valor_iptu ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_quartos ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_banheiros ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell className={`${colClass} whitespace-nowrap truncate`}>
                                    {String((p as ProdutoImobiliaria).imovel_vagas_garagem ?? '-') || '-'}
                                  </TableCell>
                                  <TableCell
                                    className={`${colClass} whitespace-nowrap truncate`}
                                    title={toTitleText((p as ProdutoImobiliaria).imovel_descricao)}
                                  >
                                    {toCellText((p as ProdutoImobiliaria).imovel_descricao)}
                                  </TableCell>
                                  <TableCell className={`${linkColClass} whitespace-nowrap text-right`}>
                                    {sanitizeLink((p as ProdutoImobiliaria).imovel_link) ? (
                                      <a
                                        href={sanitizeLink((p as ProdutoImobiliaria).imovel_link)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-end gap-1 text-sm text-black hover:underline"
                                      >
                                        Abrir <ExternalLink className="h-4 w-4" />
                                      </a>
                                    ) : (
                                      '-'
                                    )}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </table>
                  </div>

                  {pagination.totalItems > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border/50 bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-muted-foreground">
                        Mostrando <span className="text-foreground font-medium">{pagination.startIndex + 1}</span>–<span className="text-foreground font-medium">{pagination.endIndex}</span> de{' '}
                        <span className="text-foreground font-medium">{pagination.totalItems}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={pagination.currentPage <= 1}
                        >
                          Anterior
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          Página <span className="text-foreground font-medium">{pagination.currentPage}</span> de{' '}
                          <span className="text-foreground font-medium">{pagination.totalPages}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl"
                          onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                          disabled={pagination.currentPage >= pagination.totalPages}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canManageItems ? (
                <>
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir itens selecionados?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                          <br />
                          Itens selecionados: <strong>{selectedCount}</strong>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleConfirmDeleteSelected}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deleting}
                        >
                          {deleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Dialog
                    open={editOpen}
                    onOpenChange={(open) => {
                      if (!open) setEditing(null);
                      setEditOpen(open);
                    }}
                  >
                    <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Editar produto</DialogTitle>
                        <DialogDescription>Atualize os campos e salve para aplicar no estoque.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {estoqueKind === 'carro' ? (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-marca" className="text-xs font-medium">Marca</Label>
                              <Input
                                id="edit-marca"
                                value={editForm.marca}
                                onChange={(e) => setEditForm((p) => ({ ...p, marca: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: NISSAN"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-modelo" className="text-xs font-medium">Modelo</Label>
                              <Input
                                id="edit-modelo"
                                value={editForm.modelo}
                                onChange={(e) => setEditForm((p) => ({ ...p, modelo: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: KICKS 1.6 16V FLEXSTART"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-ano" className="text-xs font-medium">Ano / Modelo</Label>
                              <Input
                                id="edit-ano"
                                value={editForm.ano_modelo}
                                onChange={(e) => setEditForm((p) => ({ ...p, ano_modelo: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: 2019/2020"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-km" className="text-xs font-medium">Quilometragem</Label>
                              <Input
                                id="edit-km"
                                value={formatThousandsDisplay(editForm.quilometragem)}
                                onChange={(e) => setEditForm((p) => ({ ...p, quilometragem: formatThousandsDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="Ex: 101.000"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-portas" className="text-xs font-medium">Portas</Label>
                              <Input
                                id="edit-portas"
                                value={editForm.portas}
                                onChange={(e) => setEditForm((p) => ({ ...p, portas: toPureNumberString(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="Ex: 4"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-cor" className="text-xs font-medium">Cor</Label>
                              <Input
                                id="edit-cor"
                                value={editForm.cor}
                                onChange={(e) => setEditForm((p) => ({ ...p, cor: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Prata"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-combustivel" className="text-xs font-medium">Combustível</Label>
                              <Input
                                id="edit-combustivel"
                                value={editForm.combustivel}
                                onChange={(e) => setEditForm((p) => ({ ...p, combustivel: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Flex"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-transmissao" className="text-xs font-medium">Transmissão</Label>
                              <Input
                                id="edit-transmissao"
                                value={editForm.transmissao}
                                onChange={(e) => setEditForm((p) => ({ ...p, transmissao: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Automático"
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-preco" className="text-xs font-medium">Preço</Label>
                              <Input
                                id="edit-preco"
                                value={formatCurrencyDisplay(editForm.preco)}
                                onChange={(e) => setEditForm((p) => ({ ...p, preco: formatCurrencyDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-link" className="text-xs font-medium">Link do Anúncio</Label>
                              <Input
                                id="edit-link"
                                value={editForm.link_do_carro}
                                onChange={(e) => setEditForm((p) => ({ ...p, link_do_carro: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="https://..."
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-descricao" className="text-xs font-medium">Descrição</Label>
                              <Textarea
                                id="edit-descricao"
                                value={editForm.descricao}
                                onChange={(e) => setEditForm((p) => ({ ...p, descricao: e.target.value }))}
                                className="bg-background min-h-[100px]"
                                placeholder="Itens de série, características, observações..."
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-imovel-titulo" className="text-xs font-medium">Título do Imóvel</Label>
                              <Input
                                id="edit-imovel-titulo"
                                value={editImovelForm.imovel_titulo}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_titulo: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Apartamento 2 quartos no centro"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-transacao" className="text-xs font-medium">Transação</Label>
                              <Input
                                id="edit-imovel-transacao"
                                value={editImovelForm.imovel_transacao}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_transacao: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Venda / Aluguel"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-propriedade" className="text-xs font-medium">Tipo de Propriedade</Label>
                              <Input
                                id="edit-imovel-propriedade"
                                value={editImovelForm.imovel_propriedade}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_propriedade: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Apartamento, Casa, Terreno"
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-imovel-endereco" className="text-xs font-medium">Endereço</Label>
                              <Input
                                id="edit-imovel-endereco"
                                value={editImovelForm.imovel_endereco}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_endereco: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Rua, número, bairro, cidade"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-valor-venda" className="text-xs font-medium">Valor de Venda</Label>
                              <Input
                                id="edit-imovel-valor-venda"
                                value={formatCurrencyDisplay(editImovelForm.imovel_valor_venda)}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_valor_venda: formatCurrencyDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-valor-aluguel" className="text-xs font-medium">Valor de Aluguel</Label>
                              <Input
                                id="edit-imovel-valor-aluguel"
                                value={formatCurrencyDisplay(editImovelForm.imovel_valor_aluguel)}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_valor_aluguel: formatCurrencyDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-area" className="text-xs font-medium">Área (m²)</Label>
                              <Input
                                id="edit-imovel-area"
                                value={formatThousandsDisplay(editImovelForm.imovel_area)}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_area: formatThousandsDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="Ex: 85"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-condominio" className="text-xs font-medium">Valor Condomínio</Label>
                              <Input
                                id="edit-imovel-condominio"
                                value={formatCurrencyDisplay(editImovelForm.imovel_valor_condominio)}
                                onChange={(e) =>
                                  setEditImovelForm((p) => ({ ...p, imovel_valor_condominio: formatCurrencyDisplay(e.target.value) }))
                                }
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="edit-imovel-iptu" className="text-xs font-medium">Valor IPTU</Label>
                              <Input
                                id="edit-imovel-iptu"
                                value={formatCurrencyDisplay(editImovelForm.imovel_valor_iptu)}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_valor_iptu: formatCurrencyDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-imovel-quartos" className="text-xs font-medium">Quartos</Label>
                                <Input
                                  id="edit-imovel-quartos"
                                  value={editImovelForm.imovel_quartos}
                                  onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_quartos: toPureNumberString(e.target.value) }))}
                                  className="bg-background h-9"
                                  placeholder="0"
                                  inputMode="numeric"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-imovel-banheiros" className="text-xs font-medium">Banheiros</Label>
                                <Input
                                  id="edit-imovel-banheiros"
                                  value={editImovelForm.imovel_banheiros}
                                  onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_banheiros: toPureNumberString(e.target.value) }))}
                                  className="bg-background h-9"
                                  placeholder="0"
                                  inputMode="numeric"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-imovel-vagas" className="text-xs font-medium">Vagas Garagem</Label>
                                <Input
                                  id="edit-imovel-vagas"
                                  value={editImovelForm.imovel_vagas_garagem}
                                  onChange={(e) =>
                                    setEditImovelForm((p) => ({ ...p, imovel_vagas_garagem: toPureNumberString(e.target.value) }))
                                  }
                                  className="bg-background h-9"
                                  placeholder="0"
                                  inputMode="numeric"
                                />
                              </div>
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-imovel-link" className="text-xs font-medium">Link do Anúncio</Label>
                              <Input
                                id="edit-imovel-link"
                                value={editImovelForm.imovel_link}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_link: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="https://..."
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-imovel-descricao" className="text-xs font-medium">Descrição</Label>
                              <Textarea
                                id="edit-imovel-descricao"
                                value={editImovelForm.imovel_descricao}
                                onChange={(e) => setEditImovelForm((p) => ({ ...p, imovel_descricao: e.target.value }))}
                                className="bg-background min-h-[100px]"
                                placeholder="Descrição detalhada do imóvel..."
                              />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="edit-imovel-caracteristicas" className="text-xs font-medium">Características</Label>
                              <Textarea
                                id="edit-imovel-caracteristicas"
                                value={editImovelForm.imovel_caracteristicas}
                                onChange={(e) =>
                                  setEditImovelForm((p) => ({ ...p, imovel_caracteristicas: e.target.value }))
                                }
                                className="bg-background min-h-[80px]"
                                placeholder="Churrasqueira, piscina, elevador, etc..."
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
                          Cancelar
                        </Button>
                        <Button type="button" onClick={handleSaveEdit} disabled={savingEdit}>
                          {savingEdit ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={addOpen}
                    onOpenChange={(open) => {
                      setAddOpen(open);
                    }}
                  >
                    <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Adicionar produto</DialogTitle>
                        <DialogDescription>Preencha os campos para inserir um novo produto no estoque.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {estoqueKind === 'carro' ? (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor="add-marca" className="text-xs font-medium">Marca</Label>
                              <Input
                                id="add-marca"
                                value={addForm.marca}
                                onChange={(e) => setAddForm((p) => ({ ...p, marca: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: NISSAN"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-modelo" className="text-xs font-medium">Modelo</Label>
                              <Input
                                id="add-modelo"
                                value={addForm.modelo}
                                onChange={(e) => setAddForm((p) => ({ ...p, modelo: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: KICKS 1.6 16V FLEXSTART"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="add-ano" className="text-xs font-medium">Ano / Modelo</Label>
                              <Input
                                id="add-ano"
                                value={addForm.ano_modelo}
                                onChange={(e) => setAddForm((p) => ({ ...p, ano_modelo: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: 2019/2020"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-km" className="text-xs font-medium">Quilometragem</Label>
                              <Input
                                id="add-km"
                                value={formatThousandsDisplay(addForm.quilometragem)}
                                onChange={(e) => setAddForm((p) => ({ ...p, quilometragem: formatThousandsDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="Ex: 101.000"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="add-portas" className="text-xs font-medium">Portas</Label>
                              <Input
                                id="add-portas"
                                value={addForm.portas}
                                onChange={(e) => setAddForm((p) => ({ ...p, portas: toPureNumberString(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="Ex: 4"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-cor" className="text-xs font-medium">Cor</Label>
                              <Input
                                id="add-cor"
                                value={addForm.cor}
                                onChange={(e) => setAddForm((p) => ({ ...p, cor: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Prata"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="add-combustivel" className="text-xs font-medium">Combustível</Label>
                              <Input
                                id="add-combustivel"
                                value={addForm.combustivel}
                                onChange={(e) => setAddForm((p) => ({ ...p, combustivel: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Flex"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-transmissao" className="text-xs font-medium">Transmissão</Label>
                              <Input
                                id="add-transmissao"
                                value={addForm.transmissao}
                                onChange={(e) => setAddForm((p) => ({ ...p, transmissao: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Automático"
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-preco" className="text-xs font-medium">Preço</Label>
                              <Input
                                id="add-preco"
                                value={formatCurrencyDisplay(addForm.preco)}
                                onChange={(e) => setAddForm((p) => ({ ...p, preco: formatCurrencyDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-link" className="text-xs font-medium">Link do Anúncio</Label>
                              <Input
                                id="add-link"
                                value={addForm.link_do_carro}
                                onChange={(e) => setAddForm((p) => ({ ...p, link_do_carro: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="https://..."
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-descricao" className="text-xs font-medium">Descrição</Label>
                              <Textarea
                                id="add-descricao"
                                value={addForm.descricao}
                                onChange={(e) => setAddForm((p) => ({ ...p, descricao: e.target.value }))}
                                className="bg-background min-h-[100px]"
                                placeholder="Itens de série, características, observações..."
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-imovel-titulo" className="text-xs font-medium">Título do Imóvel</Label>
                              <Input
                                id="add-imovel-titulo"
                                value={addImovelForm.imovel_titulo}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_titulo: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Apartamento 2 quartos no centro"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-transacao" className="text-xs font-medium">Transação</Label>
                              <Input
                                id="add-imovel-transacao"
                                value={addImovelForm.imovel_transacao}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_transacao: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Ex: Venda / Aluguel"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-propriedade" className="text-xs font-medium">Tipo de Propriedade</Label>
                              <Input
                                id="add-imovel-propriedade"
                                value={addImovelForm.imovel_propriedade}
                                onChange={(e) =>
                                  setAddImovelForm((p) => ({ ...p, imovel_propriedade: e.target.value }))
                                }
                                className="bg-background h-9"
                                placeholder="Ex: Apartamento, Casa, Terreno"
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-imovel-endereco" className="text-xs font-medium">Endereço</Label>
                              <Input
                                id="add-imovel-endereco"
                                value={addImovelForm.imovel_endereco}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_endereco: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="Rua, número, bairro, cidade"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-valor-venda" className="text-xs font-medium">Valor de Venda</Label>
                              <Input
                                id="add-imovel-valor-venda"
                                value={formatCurrencyDisplay(addImovelForm.imovel_valor_venda)}
                                onChange={(e) =>
                                  setAddImovelForm((p) => ({ ...p, imovel_valor_venda: formatCurrencyDisplay(e.target.value) }))
                                }
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-valor-aluguel" className="text-xs font-medium">Valor de Aluguel</Label>
                              <Input
                                id="add-imovel-valor-aluguel"
                                value={formatCurrencyDisplay(addImovelForm.imovel_valor_aluguel)}
                                onChange={(e) =>
                                  setAddImovelForm((p) => ({ ...p, imovel_valor_aluguel: formatCurrencyDisplay(e.target.value) }))
                                }
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-area" className="text-xs font-medium">Área (m²)</Label>
                              <Input
                                id="add-imovel-area"
                                value={formatThousandsDisplay(addImovelForm.imovel_area)}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_area: formatThousandsDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="Ex: 85"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-condominio" className="text-xs font-medium">Valor Condomínio</Label>
                              <Input
                                id="add-imovel-condominio"
                                value={formatCurrencyDisplay(addImovelForm.imovel_valor_condominio)}
                                onChange={(e) =>
                                  setAddImovelForm((p) => ({ ...p, imovel_valor_condominio: formatCurrencyDisplay(e.target.value) }))
                                }
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>

                            <div className="grid gap-2">
                              <Label htmlFor="add-imovel-iptu" className="text-xs font-medium">Valor IPTU</Label>
                              <Input
                                id="add-imovel-iptu"
                                value={formatCurrencyDisplay(addImovelForm.imovel_valor_iptu)}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_valor_iptu: formatCurrencyDisplay(e.target.value) }))}
                                className="bg-background h-9"
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                              <div className="grid gap-2">
                                <Label htmlFor="add-imovel-quartos" className="text-xs font-medium">Quartos</Label>
                                <Input
                                  id="add-imovel-quartos"
                                  value={addImovelForm.imovel_quartos}
                                  onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_quartos: toPureNumberString(e.target.value) }))}
                                  className="bg-background h-9"
                                  placeholder="0"
                                  inputMode="numeric"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="add-imovel-banheiros" className="text-xs font-medium">Banheiros</Label>
                                <Input
                                  id="add-imovel-banheiros"
                                  value={addImovelForm.imovel_banheiros}
                                  onChange={(e) =>
                                    setAddImovelForm((p) => ({ ...p, imovel_banheiros: toPureNumberString(e.target.value) }))
                                  }
                                  className="bg-background h-9"
                                  placeholder="0"
                                  inputMode="numeric"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="add-imovel-vagas" className="text-xs font-medium">Vagas Garagem</Label>
                                <Input
                                  id="add-imovel-vagas"
                                  value={addImovelForm.imovel_vagas_garagem}
                                  onChange={(e) =>
                                    setAddImovelForm((p) => ({ ...p, imovel_vagas_garagem: toPureNumberString(e.target.value) }))
                                  }
                                  className="bg-background h-9"
                                  placeholder="0"
                                  inputMode="numeric"
                                />
                              </div>
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-imovel-link" className="text-xs font-medium">Link do Anúncio</Label>
                              <Input
                                id="add-imovel-link"
                                value={addImovelForm.imovel_link}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_link: e.target.value }))}
                                className="bg-background h-9"
                                placeholder="https://..."
                              />
                            </div>

                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-imovel-descricao" className="text-xs font-medium">Descrição</Label>
                              <Textarea
                                id="add-imovel-descricao"
                                value={addImovelForm.imovel_descricao}
                                onChange={(e) => setAddImovelForm((p) => ({ ...p, imovel_descricao: e.target.value }))}
                                className="bg-background min-h-[100px]"
                                placeholder="Descrição detalhada do imóvel..."
                              />
                            </div>
                            <div className="grid gap-2 sm:col-span-2">
                              <Label htmlFor="add-imovel-caracteristicas" className="text-xs font-medium">Características</Label>
                              <Textarea
                                id="add-imovel-caracteristicas"
                                value={addImovelForm.imovel_caracteristicas}
                                onChange={(e) =>
                                  setAddImovelForm((p) => ({ ...p, imovel_caracteristicas: e.target.value }))
                                }
                                className="bg-background min-h-[80px]"
                                placeholder="Churrasqueira, piscina, elevador, etc..."
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={savingAdd}>
                          Cancelar
                        </Button>
                        <Button type="button" onClick={handleCreateNew} disabled={savingAdd}>
                          {savingAdd ? 'Adicionando...' : 'Adicionar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EstoqueDeProdutosTab;
