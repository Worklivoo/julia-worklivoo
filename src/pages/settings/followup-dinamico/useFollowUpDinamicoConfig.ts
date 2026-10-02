import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Params {
  user: any;
  settingsOwnerUserId: string | null;
}

/** Configuração, ciclo e histórico do FollowUp Dinâmico (leitura e salvamento dos dias). */
export const useFollowUpDinamicoConfig = ({ user, settingsOwnerUserId }: Params) => {
  const { toast } = useToast();

  const [followupDinamicoAtivo, setFollowupDinamicoAtivo] = useState<boolean>(false);
  const [followupDinamicoVolume, setFollowupDinamicoVolume] = useState<string>('');
  const [followupDinamicoDiasPerdidos, setFollowupDinamicoDiasPerdidos] = useState<string>('');
  const [loadingFollowupDinamicoConfig, setLoadingFollowupDinamicoConfig] = useState<boolean>(false);
  const [isSavingFollowupDinamicoConfig, setIsSavingFollowupDinamicoConfig] = useState<boolean>(false);
  const [isEditingFollowupDinamicoDias, setIsEditingFollowupDinamicoDias] = useState<boolean>(false);
  const [followupDinamicoHistorico, setFollowupDinamicoHistorico] = useState<any[]>([]);
  const [loadingFollowupDinamicoHistorico, setLoadingFollowupDinamicoHistorico] = useState<boolean>(false);

  const [userPagamentoConfig, setUserPagamentoConfig] = useState<{
    id_cliente_asaas: string;
    id_assinatura_asaas: string;
    dia_vencimento: string;
    user_valor_mensal: number;
    user_nome?: string;
    user_empresa?: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFollowupDinamicoConfig(true);
      try {
        const { data, error } = await supabase
          .from('usuarios_v2')
          .select(`
            followup_dinamico,
            followup_dinamico_volume,
            followup_dinamico_dias_perdidos,
            id_cliente_asaas,
            id_assinatura_asaas,
            dia_vencimento,
            user_valor_mensal,
            user_nome,
            user_empresa
          `)
          .eq('user_id', settingsOwnerUserId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const d = data as any;

        const ativo = Boolean(d.followup_dinamico ?? false);
        const volume =
          d.followup_dinamico_volume === null || d.followup_dinamico_volume === undefined
            ? ''
            : String(d.followup_dinamico_volume);
        const dias =
          d.followup_dinamico_dias_perdidos === null || d.followup_dinamico_dias_perdidos === undefined
            ? ''
            : String(d.followup_dinamico_dias_perdidos);

        setFollowupDinamicoAtivo(ativo);
        setFollowupDinamicoVolume(volume);
        setFollowupDinamicoDiasPerdidos(dias);

        setUserPagamentoConfig({
          id_cliente_asaas: String(d.id_cliente_asaas ?? '').trim(),
          id_assinatura_asaas: String(d.id_assinatura_asaas ?? '').trim(),
          dia_vencimento: String(d.dia_vencimento ?? '').trim(),
          user_valor_mensal: Number(d.user_valor_mensal) || 0,
          user_nome: d.user_nome ?? undefined,
          user_empresa: d.user_empresa ?? undefined,
        });

        console.info('[FU Dinamico Init] userPagamentoConfig carregado do banco:', {
          id_cliente_asaas: String(d.id_cliente_asaas ?? '').trim()
            ? `${String(d.id_cliente_asaas ?? '').slice(0, 4)}...${String(d.id_cliente_asaas ?? '').slice(-3)}`
            : '<VAZIO>',
          id_assinatura_asaas: String(d.id_assinatura_asaas ?? '').trim()
            ? `${String(d.id_assinatura_asaas ?? '').slice(0, 4)}...${String(d.id_assinatura_asaas ?? '').slice(-3)}`
            : '<VAZIO>',
          dia_vencimento: d.dia_vencimento,
          user_valor_mensal: d.user_valor_mensal,
        });
      } catch (err: any) {
        console.error('[FollowUp Dinamico] Erro ao carregar configuração:', err);
      } finally {
        setLoadingFollowupDinamicoConfig(false);
      }
    };
    load();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const load = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFollowupDinamicoHistorico(true);
      try {
        const { data, error } = await supabase
          .from('followup_dinamico_v2')
          .select('*')
          .eq('user_id', settingsOwnerUserId)
          .eq('followup_dinamico', true)
          .order('criado_em', { ascending: false })
          .limit(100);

        console.debug('[FollowUp Dinamico] Histórico bruto (followup_dinamico_v2):', { data, error });
        if (error) throw error;
        setFollowupDinamicoHistorico(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('[FollowUp Dinamico] Erro ao carregar histórico:', err);
        setFollowupDinamicoHistorico([]);
      } finally {
        setLoadingFollowupDinamicoHistorico(false);
      }
    };
    load();
  }, [settingsOwnerUserId]);

  const followupDinamicoCiclo = useMemo(() => {
    const diaVencimentoRaw =
      userPagamentoConfig?.dia_vencimento?.trim()
        ? userPagamentoConfig.dia_vencimento.trim()
        : (
          user?.dia_vencimento !== undefined && user?.dia_vencimento !== null
            ? String(user.dia_vencimento).trim()
            : ''
        );
    const diaVencimentoNum = diaVencimentoRaw ? Number(diaVencimentoRaw) : NaN;
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const diaHoje = hoje.getDate();

    const diasMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();

    let inicio: Date | null = null;
    let fim: Date | null = null;
    let diaVencimentoAjustado: number | null = null;

    if (Number.isFinite(diaVencimentoNum) && diaVencimentoNum > 0) {
      const maxDiaAtual = diasMes(anoAtual, mesAtual);
      diaVencimentoAjustado = Math.min(Math.max(1, Math.trunc(diaVencimentoNum)), maxDiaAtual);

      if (diaHoje >= diaVencimentoAjustado) {
        const maxInicio = diasMes(anoAtual, mesAtual);
        const inicioDia = Math.min(diaVencimentoAjustado, maxInicio);
        inicio = new Date(anoAtual, mesAtual, inicioDia, 0, 0, 0, 0);

        const proxMes = mesAtual + 1;
        const anoFim = proxMes > 11 ? anoAtual + 1 : anoAtual;
        const mesFim = proxMes > 11 ? 0 : proxMes;
        const maxFim = diasMes(anoFim, mesFim);
        const fimDia = Math.min(diaVencimentoAjustado, maxFim);
        fim = new Date(anoFim, mesFim, fimDia, 23, 59, 59, 999);
      } else {
        const mesAnterior = mesAtual - 1;
        const anoInicio = mesAnterior < 0 ? anoAtual - 1 : anoAtual;
        const mesInicio = mesAnterior < 0 ? 11 : mesAnterior;
        const maxInicio = diasMes(anoInicio, mesInicio);
        const inicioDia = Math.min(diaVencimentoAjustado, maxInicio);
        inicio = new Date(anoInicio, mesInicio, inicioDia, 0, 0, 0, 0);

        const maxFim = diasMes(anoAtual, mesAtual);
        const fimDia = Math.min(diaVencimentoAjustado, maxFim);
        fim = new Date(anoAtual, mesAtual, fimDia, 23, 59, 59, 999);
      }
    }

    const formatarData = (valor: Date | null) =>
      valor ? valor.toLocaleDateString('pt-BR') : '-';

    const enviadosCiclo = (() => {
      if (!inicio || !fim) return 0;
      const lista = Array.isArray(followupDinamicoHistorico) ? followupDinamicoHistorico : [];
      return lista.reduce((acc: number, row: any) => {
        try {
          const criadoRaw = row?.criado_em;
          if (!criadoRaw) return acc;
          const data = new Date(String(criadoRaw));
          if (Number.isNaN(data.getTime())) return acc;
          return data >= inicio && data <= fim ? acc + 1 : acc;
        } catch {
          return acc;
        }
      }, 0);
    })();

    const volumeNumRaw = String(followupDinamicoVolume || '').trim();
    const volumeNum = volumeNumRaw ? Number(volumeNumRaw) : NaN;
    const volumeValido = Number.isFinite(volumeNum) && volumeNum >= 0 ? volumeNum : 0;
    const pendentesCiclo = Math.max(volumeValido - enviadosCiclo, 0);
    const progressoCiclo =
      volumeValido > 0 ? Math.min(Math.max((enviadosCiclo / volumeValido) * 100, 0), 100) : 0;

    console.debug('[FollowUp Dinamico] Ciclo calculado:', {
      dia_vencimento_raw: userPagamentoConfig?.dia_vencimento ?? user?.dia_vencimento,
      diaVencimentoNum,
      diaVencimentoAjustado,
      inicio: inicio?.toISOString(),
      fim: fim?.toISOString(),
      enviadosCiclo,
      volumeValido,
      pendentesCiclo,
      progressoCiclo,
    });

    return {
      diaVencimentoRaw,
      diaVencimentoNum: Number.isFinite(diaVencimentoNum) ? diaVencimentoNum : null,
      inicio,
      fim,
      inicioFormatado: formatarData(inicio),
      fimFormatado: formatarData(fim),
      enviadosCiclo,
      volumeValido,
      pendentesCiclo,
      progressoCiclo,
    };
  }, [userPagamentoConfig?.dia_vencimento, user?.dia_vencimento, followupDinamicoHistorico, followupDinamicoVolume]);

  const handleSaveFollowupDinamicoConfig = async () => {
    if (!settingsOwnerUserId) {
      toast({ title: 'Atenção', description: 'Usuário não identificado.' });
      return;
    }

    const volumeRaw = String(followupDinamicoVolume || '').trim();
    const diasRaw = String(followupDinamicoDiasPerdidos || '').trim();

    const volume = volumeRaw ? Number(volumeRaw) : null;
    const dias = diasRaw ? Number(diasRaw) : null;

    if (volumeRaw && (!Number.isFinite(volume) || volume < 0)) {
      toast({ title: 'Atenção', description: 'Quantidade de followups por ciclo deve ser um número válido.' });
      return;
    }
    if (diasRaw) {
      if (!Number.isFinite(dias)) {
        toast({ title: 'Atenção', description: 'Quantidade de dias perdidos deve ser um número válido.' });
        return;
      }
      if (dias! < 30 || dias! > 360) {
        toast({ title: 'Atenção', description: 'A quantidade de dias deve ser entre 30 e 360.' });
        return;
      }
    }

    setIsSavingFollowupDinamicoConfig(true);
    try {
      const { error } = await supabase
        .from('usuarios_v2')
        .update({
          followup_dinamico: Boolean(followupDinamicoAtivo),
          followup_dinamico_volume: volume,
          followup_dinamico_dias_perdidos: dias,
        } as any)
        .eq('user_id', settingsOwnerUserId);

      if (error) throw error;

      setIsEditingFollowupDinamicoDias(false);

      toast({
        title: 'Configuração salva',
        description: diasRaw
          ? `Quantidade de dias para leads perdidos atualizada para ${Number(dias).toLocaleString('pt-BR')} dia${Number(dias) === 1 ? '' : 's'}.`
          : 'As preferências de FollowUp Dinâmico foram salvas.',
      });
    } catch (err: any) {
      console.error('[FollowUp Dinamico] Erro ao salvar configuração:', err);
      toast({ title: 'Erro', description: err?.message || 'Não foi possível salvar as alterações.' });
    } finally {
      setIsSavingFollowupDinamicoConfig(false);
    }
  };

  return {
    followupDinamicoAtivo,
    setFollowupDinamicoAtivo,
    followupDinamicoVolume,
    setFollowupDinamicoVolume,
    followupDinamicoDiasPerdidos,
    setFollowupDinamicoDiasPerdidos,
    loadingFollowupDinamicoConfig,
    setLoadingFollowupDinamicoConfig,
    isSavingFollowupDinamicoConfig,
    setIsSavingFollowupDinamicoConfig,
    isEditingFollowupDinamicoDias,
    setIsEditingFollowupDinamicoDias,
    followupDinamicoHistorico,
    setFollowupDinamicoHistorico,
    loadingFollowupDinamicoHistorico,
    setLoadingFollowupDinamicoHistorico,
    userPagamentoConfig,
    setUserPagamentoConfig,
    followupDinamicoCiclo,
    handleSaveFollowupDinamicoConfig,
  };
};

export type FollowUpDinamicoConfig = ReturnType<typeof useFollowUpDinamicoConfig>;
