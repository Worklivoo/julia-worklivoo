import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Params {
  user: any;
  settingsOwnerUserId: string | null;
}

/** Configuração (dias, frequência, etapas), ciclo e histórico do FollowUp Extendido. */
export const useFollowUpExtendidoConfig = ({ user, settingsOwnerUserId }: Params) => {
  const { toast } = useToast();

  const [followupExtendidoAtivo, setFollowupExtendidoAtivo] = useState<boolean>(false);
  const [followupExtendidoVolume, setFollowupExtendidoVolume] = useState<string>('');
  const [followupExtendidoDiasPerdidos, setFollowupExtendidoDiasPerdidos] = useState<string>('');
  const [followupExtendidoFrequencia, setFollowupExtendidoFrequencia] = useState<string>('');
  const [followupExtendidoEtapas, setFollowupExtendidoEtapas] = useState<string[]>([]);
  const [loadingFollowupExtendidoConfig, setLoadingFollowupExtendidoConfig] = useState<boolean>(false);
  const [isSavingFollowupExtendidoConfig, setIsSavingFollowupExtendidoConfig] = useState<boolean>(false);
  const [isEditingFollowupExtendidoDias, setIsEditingFollowupExtendidoDias] = useState<boolean>(false);
  const [isEditingFollowupExtendidoEtapas, setIsEditingFollowupExtendidoEtapas] = useState<boolean>(false);
  const [followupExtendidoHistorico, setFollowupExtendidoHistorico] = useState<any[]>([]);
  const [loadingFollowupExtendidoHistorico, setLoadingFollowupExtendidoHistorico] = useState<boolean>(false);

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
      setLoadingFollowupExtendidoConfig(true);
      try {
        const { data, error } = await supabase
          .from('usuarios_v2')
          .select(`
            followup_extendido,
            followup_extendido_volume,
            followup_extendido_dias_perdidos,
            followup_extendido_etapas,
            followup_extendido_frequencia,
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

        const ativo = Boolean(d.followup_extendido ?? false);
        const volume =
          d.followup_extendido_volume === null || d.followup_extendido_volume === undefined
            ? ''
            : String(d.followup_extendido_volume);
        const dias =
          d.followup_extendido_dias_perdidos === null || d.followup_extendido_dias_perdidos === undefined
            ? ''
            : String(d.followup_extendido_dias_perdidos);
        const etapas = String(d.followup_extendido_etapas ?? '')
          .split(',')
          .map((etapa: string) => etapa.trim())
          .filter(Boolean);
        const frequencia =
          d.followup_extendido_frequencia === null || d.followup_extendido_frequencia === undefined
            ? ''
            : String(d.followup_extendido_frequencia);

        setFollowupExtendidoAtivo(ativo);
        setFollowupExtendidoVolume(volume);
        setFollowupExtendidoDiasPerdidos(dias);
        setFollowupExtendidoEtapas(etapas);
        setFollowupExtendidoFrequencia(frequencia);

        setUserPagamentoConfig({
          id_cliente_asaas: String(d.id_cliente_asaas ?? '').trim(),
          id_assinatura_asaas: String(d.id_assinatura_asaas ?? '').trim(),
          dia_vencimento: String(d.dia_vencimento ?? '').trim(),
          user_valor_mensal: Number(d.user_valor_mensal) || 0,
          user_nome: d.user_nome ?? undefined,
          user_empresa: d.user_empresa ?? undefined,
        });

        console.info('[FU Extendido Init] userPagamentoConfig carregado do banco:', {
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
        console.error('[FollowUp Extendido] Erro ao carregar configuração:', err);
      } finally {
        setLoadingFollowupExtendidoConfig(false);
      }
    };
    load();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const load = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFollowupExtendidoHistorico(true);
      try {
        const { data, error } = await supabase
          .from('followup_extendido_v2')
          .select('*')
          .eq('user_id', settingsOwnerUserId)
          .eq('followup_extendido', true)
          .order('criado_em', { ascending: false })
          .limit(100);

        console.debug('[FollowUp Extendido] Histórico bruto (followup_extendido_v2):', { data, error });
        if (error) throw error;
        setFollowupExtendidoHistorico(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('[FollowUp Extendido] Erro ao carregar histórico:', err);
        setFollowupExtendidoHistorico([]);
      } finally {
        setLoadingFollowupExtendidoHistorico(false);
      }
    };
    load();
  }, [settingsOwnerUserId]);

  const followupExtendidoCiclo = useMemo(() => {
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
      const lista = Array.isArray(followupExtendidoHistorico) ? followupExtendidoHistorico : [];
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

    const volumeNumRaw = String(followupExtendidoVolume || '').trim();
    const volumeNum = volumeNumRaw ? Number(volumeNumRaw) : NaN;
    const volumeValido = Number.isFinite(volumeNum) && volumeNum >= 0 ? volumeNum : 0;
    const pendentesCiclo = Math.max(volumeValido - enviadosCiclo, 0);
    const progressoCiclo =
      volumeValido > 0 ? Math.min(Math.max((enviadosCiclo / volumeValido) * 100, 0), 100) : 0;

    console.debug('[FollowUp Extendido] Ciclo calculado:', {
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
  }, [userPagamentoConfig?.dia_vencimento, user?.dia_vencimento, followupExtendidoHistorico, followupExtendidoVolume]);

  const handleSaveFollowupExtendidoConfig = async () => {
    if (!settingsOwnerUserId) {
      toast({ title: 'Atenção', description: 'Usuário não identificado.' });
      return;
    }

    const volumeRaw = String(followupExtendidoVolume || '').trim();
    const diasRaw = String(followupExtendidoDiasPerdidos || '').trim();
    const frequenciaRaw = String(followupExtendidoFrequencia || '').trim();
    const etapasSelecionadas = Array.isArray(followupExtendidoEtapas) ? followupExtendidoEtapas : [];

    const volume = volumeRaw ? Number(volumeRaw) : null;
    const dias = diasRaw ? Number(diasRaw) : null;
    const frequencia = frequenciaRaw ? Number(frequenciaRaw) : null;

    if (volumeRaw && (!Number.isFinite(volume) || volume < 0)) {
      toast({ title: 'Atenção', description: 'Quantidade de followups por ciclo deve ser um número válido.' });
      return;
    }
    // Dias, frequência e etapas nunca podem ficar em branco: o cliente configura isso após a
    // contratação e é comum esquecer, então bloqueamos o salvamento em vez de permitir valor vazio.
    if (!diasRaw) {
      toast({ title: 'Atenção', description: 'Informe os dias sem resposta (entre 7 e 360).' });
      return;
    }
    if (!Number.isFinite(dias)) {
      toast({ title: 'Atenção', description: 'Quantidade de dias sem resposta deve ser um número válido.' });
      return;
    }
    if (dias! < 7 || dias! > 360) {
      toast({ title: 'Atenção', description: 'A quantidade de dias deve ser entre 7 e 360.' });
      return;
    }
    if (!frequenciaRaw) {
      toast({ title: 'Atenção', description: 'Informe a frequência de mensagens por lead (entre 1 e 50).' });
      return;
    }
    if (!Number.isFinite(frequencia) || !Number.isInteger(frequencia)) {
      toast({ title: 'Atenção', description: 'A frequência de mensagens deve ser um número inteiro válido.' });
      return;
    }
    if (frequencia! < 1 || frequencia! > 50) {
      toast({ title: 'Atenção', description: 'A frequência de mensagens deve ser entre 1 e 50.' });
      return;
    }
    if (etapasSelecionadas.length === 0) {
      toast({ title: 'Atenção', description: 'Selecione ao menos uma etapa do funil para o FollowUp Extendido.' });
      return;
    }

    setIsSavingFollowupExtendidoConfig(true);
    try {
      const { error } = await supabase
        .from('usuarios_v2')
        .update({
          followup_extendido: Boolean(followupExtendidoAtivo),
          followup_extendido_volume: volume,
          followup_extendido_dias_perdidos: dias,
          followup_extendido_etapas: etapasSelecionadas.join(','),
          followup_extendido_frequencia: frequencia,
        } as any)
        .eq('user_id', settingsOwnerUserId);

      if (error) throw error;

      setIsEditingFollowupExtendidoDias(false);
      setIsEditingFollowupExtendidoEtapas(false);

      toast({
        title: 'Configuração salva',
        description: 'As preferências de FollowUp Extendido foram salvas.',
      });
    } catch (err: any) {
      console.error('[FollowUp Extendido] Erro ao salvar configuração:', err);
      toast({ title: 'Erro', description: err?.message || 'Não foi possível salvar as alterações.' });
    } finally {
      setIsSavingFollowupExtendidoConfig(false);
    }
  };

  return {
    followupExtendidoAtivo,
    setFollowupExtendidoAtivo,
    followupExtendidoVolume,
    setFollowupExtendidoVolume,
    followupExtendidoDiasPerdidos,
    setFollowupExtendidoDiasPerdidos,
    followupExtendidoFrequencia,
    setFollowupExtendidoFrequencia,
    followupExtendidoEtapas,
    setFollowupExtendidoEtapas,
    loadingFollowupExtendidoConfig,
    setLoadingFollowupExtendidoConfig,
    isSavingFollowupExtendidoConfig,
    setIsSavingFollowupExtendidoConfig,
    isEditingFollowupExtendidoDias,
    setIsEditingFollowupExtendidoDias,
    isEditingFollowupExtendidoEtapas,
    setIsEditingFollowupExtendidoEtapas,
    followupExtendidoHistorico,
    setFollowupExtendidoHistorico,
    loadingFollowupExtendidoHistorico,
    setLoadingFollowupExtendidoHistorico,
    userPagamentoConfig,
    setUserPagamentoConfig,
    followupExtendidoCiclo,
    handleSaveFollowupExtendidoConfig,
  };
};

export type FollowUpExtendidoConfig = ReturnType<typeof useFollowUpExtendidoConfig>;
