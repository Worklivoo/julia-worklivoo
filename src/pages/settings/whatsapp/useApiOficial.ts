import { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile } from '@/lib/supabase-utils';

/**
 * API Oficial do WhatsApp: criação (escolha do DDD e webhooks de criação/integração) e perfil comercial
 * exibido no WhatsApp (foto, categoria, sobre, descrição, endereço, e-mail e sites) via proxy da Meta.
 */
export const useApiOficial = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const [apiOfficialPhoto, setApiOfficialPhoto] = useState<File | null>(null);
  const [apiOfficialCategory, setApiOfficialCategory] = useState<string>('');
  const [apiOfficialAbout, setApiOfficialAbout] = useState<string>('');
  const [apiOfficialDescription, setApiOfficialDescription] = useState<string>('');
  const [apiOfficialAddress, setApiOfficialAddress] = useState<string>('');
  const [apiOfficialEmail, setApiOfficialEmail] = useState<string>('');
  const [apiOfficialWebsite, setApiOfficialWebsite] = useState<string>('');
  const [apiOfficialWebsite2, setApiOfficialWebsite2] = useState<string>('');
  const [apiOfficialProfilePictureUrl, setApiOfficialProfilePictureUrl] = useState<string>('');
  const [loadingApiOfficialProfile, setLoadingApiOfficialProfile] = useState<boolean>(false);
  const [apiOfficialEditMode, setApiOfficialEditMode] = useState<boolean>(false);
  const [apiOfficialDialogOpen, setApiOfficialDialogOpen] = useState(false);
  const [apiOfficialPreferredDdd, setApiOfficialPreferredDdd] = useState('');
  const [sendingApiOfficialWebhook, setSendingApiOfficialWebhook] = useState(false);
  const [startingCreateApiOfficialFlow, setStartingCreateApiOfficialFlow] = useState(false);
  const [loadingSalvyAreaCodes, setLoadingSalvyAreaCodes] = useState(false);
  const [salvyAreaCodes, setSalvyAreaCodes] = useState<string[]>([]);
  const [apiOfficialSnapshot, setApiOfficialSnapshot] = useState<{
    about: string;
    description: string;
    address: string;
    email: string;
    website1: string;
    website2: string;
    vertical: string;
    profile_picture_url: string;
    verified_name: string;
    display_phone_number: string;
  } | null>(null);
  const [savingApiOfficialProfile, setSavingApiOfficialProfile] = useState<boolean>(false);
  const [resolvedApiWhatsappId, setResolvedApiWhatsappId] = useState<string>('');
  const [loadingResolvedApiWhatsappId, setLoadingResolvedApiWhatsappId] = useState<boolean>(false);
  const [sendingIntegrateApiOfficialWebhook, setSendingIntegrateApiOfficialWebhook] = useState(false);

  const resolveBaseUserId = () => {
    const rawUser = user as any;
    const baseUserId = rawUser?.isMembro ? String(rawUser?.user_id_empresa || '').trim() : String(rawUser?.id || '').trim();
    return baseUserId;
  };

  const resolveSalvyProxyEndpoint = () => {
    const fromEnv = (import.meta as any)?.env?.VITE_SALVY_PROXY_ENDPOINT;
    if (fromEnv) return String(fromEnv);
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    ) {
      return '/api/salvy-proxy';
    }
    if ((import.meta as any)?.env?.DEV) return '/api/salvy-proxy';
    return '/salvy-proxy.php';
  };

  const loadSalvyAreaCodes = async () => {
    const proxyEndpoint = resolveSalvyProxyEndpoint();
    const url = new URL(proxyEndpoint, window.location.origin);
    url.searchParams.set('path', 'virtual-phone-accounts/area-codes');
    url.searchParams.set('available', 'true');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text().catch(() => '');
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || text || `Status ${response.status}`;
      throw new Error(String(message));
    }


    const rawAreaCodes = Array.isArray(payload?.areaCodes)
      ? payload.areaCodes
      : Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data?.areaCodes)
          ? payload.data.areaCodes
          : [];
    const uniqueAreaCodes = new Set<string>();

    for (const item of rawAreaCodes) {
      if (item?.available !== true) continue;
      const normalized = String(item?.areaCode ?? '').replace(/\D/g, '').slice(0, 2);
      if (normalized.length === 2) uniqueAreaCodes.add(normalized);
    }
    const normalizedAreaCodes = Array.from(uniqueAreaCodes).sort((a, b) => Number(a) - Number(b));
    return normalizedAreaCodes;
  };

  const handleOpenApiOfficialDialog = async () => {
    setApiOfficialPreferredDdd('');
    setLoadingSalvyAreaCodes(true);
    try {
      const availableAreaCodes = await loadSalvyAreaCodes();
      if (!availableAreaCodes.length) {
        toast({ title: 'Nenhum DDD disponivel', description: 'Nao encontramos DDDs disponiveis no momento.' });
        return;
      }
      setSalvyAreaCodes(availableAreaCodes);
      setApiOfficialDialogOpen(true);
    } catch {
      toast({
        title: 'Erro ao carregar DDDs',
        description: 'Nao foi possivel consultar os DDDs disponiveis agora. Tente novamente.',
      });
    } finally {
      setLoadingSalvyAreaCodes(false);
    }
  };

  const handleStartCreateApiOfficial = () => {
    void handleOpenApiOfficialDialog();
  };

  const hasSalvyId = String(user?.salvy_id ?? '').trim() !== '';
  const hasWabaId = String(user?.waba_id ?? '').trim() !== '';

  const handleSubmitApiOfficialWebhook = async () => {
    const ddd = String(apiOfficialPreferredDdd || '').replace(/\D/g, '').slice(0, 2);
    if (ddd.length !== 2) {
      toast({ title: 'Atenção', description: 'Digite um DDD válido com 2 números.' });
      return;
    }

    const baseUserId = resolveBaseUserId();
    if (!baseUserId) {
      toast({ title: 'Erro', description: 'Não foi possível identificar o usuário.' });
      return;
    }

    setSendingApiOfficialWebhook(true);
    try {
      const profile = await getUserProfile(baseUserId);
      const userEmpresaValue = String((profile as any)?.user_empresa ?? '').trim();
      const userIdValue = String((profile as any)?.user_id ?? '').trim();

      if (!userEmpresaValue || !userIdValue) {
        toast({ title: 'Erro', description: 'Não foi possível carregar os dados do usuário.' });
        return;
      }

      const response = await fetch('https://primary-production-d442.up.railway.app/webhook/08a65c05-5d19-41ff-b8fb-a740fdbd9096', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ddd,
          user_empresa: userEmpresaValue,
          user_id: userIdValue,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook retornou status ${response.status}`);
      }

      setApiOfficialDialogOpen(false);
      setApiOfficialPreferredDdd('');
      setStartingCreateApiOfficialFlow(true);
      toast({
        title: 'Solicitação enviada',
        description: 'Aguarde, em poucos minutos a conexão será realizada.',
      });
    } catch {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível enviar a solicitação agora. Tente novamente.',
      });
    } finally {
      setSendingApiOfficialWebhook(false);
    }
  };

  const handleIntegrateApiOfficial = async () => {
    const baseUserId = resolveBaseUserId();
    if (!baseUserId) {
      toast({ title: 'Erro', description: 'Não foi possível identificar o usuário.' });
      return;
    }

    setSendingIntegrateApiOfficialWebhook(true);
    try {
      const profile = await getUserProfile(baseUserId);
      const userIdValue = String((profile as any)?.user_id ?? '').trim();
      const salvyIdValue = String((profile as any)?.salvy_id ?? '').trim();
      const idApiWhatsappValue = String((profile as any)?.id_api_whatsapp ?? '').trim();
      const wabaIdValue = String((profile as any)?.waba_id ?? '').trim();

      if (!userIdValue || !salvyIdValue || !idApiWhatsappValue || !wabaIdValue) {
        toast({ title: 'Erro', description: 'Não foi possível carregar os dados necessários para a integração.' });
        return;
      }

      const response = await fetch('https://primary-production-d442.up.railway.app/webhook/2fdc78c8-a2f1-4ac0-98ab-1dd6bcddae34', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userIdValue,
          salvy_id: salvyIdValue,
          id_api_whatsapp: idApiWhatsappValue,
          waba_id: wabaIdValue,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook retornou status ${response.status}`);
      }

      toast({
        title: 'Solicitação enviada',
        description: 'A integração da API Oficial foi solicitada com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro ao integrar',
        description: 'Não foi possível enviar a solicitação agora. Tente novamente.',
      });
    } finally {
      setSendingIntegrateApiOfficialWebhook(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!user?.api_oficial) return;
      const rawUser = user as any;
      const baseUserId = rawUser?.isMembro ? String(rawUser?.user_id_empresa || '').trim() : String(rawUser?.id || '').trim();
      if (!baseUserId) return;

      setResolvedApiWhatsappId(String((rawUser?.id_api_whatsapp ?? '') as any));
      setLoadingResolvedApiWhatsappId(true);
      try {
        const profile = await getUserProfile(baseUserId);
        const idFromDb = String((profile as any)?.id_api_whatsapp ?? '').trim();
        if (idFromDb) {
          setResolvedApiWhatsappId(idFromDb);
        }
      } catch {
        // noop
      } finally {
        setLoadingResolvedApiWhatsappId(false);
      }
    };
    run();
  }, [user?.api_oficial, user?.id]);

  const META_GRAPH_VERSION = 'v21.0';
  const EMPTY_VERTICAL = '__EMPTY__';
  const verticalLabel = (value: string) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '-';
    if (raw === EMPTY_VERTICAL) return 'Sem categoria';
    const map: Record<string, string> = {
      ALCOHOL: 'Bebidas alcoólicas',
      APPAREL: 'Vestuário',
      AUTO: 'Automotivo',
      BEAUTY: 'Beleza',
      EDU: 'Educação',
      ENTERTAIN: 'Entretenimento',
      EVENT_PLAN: 'Eventos',
      FINANCE: 'Finanças',
      GOVT: 'Governo',
      GROCERY: 'Mercado',
      HEALTH: 'Saúde',
      HOTEL: 'Hotelaria',
      MATRIMONY_SERVICE: 'Serviço de matrimônio',
      NONPROFIT: 'Sem fins lucrativos',
      ONLINE_GAMBLING: 'Apostas online',
      OTC_DRUGS: 'Medicamentos OTC',
      OTHER: 'Outro',
      PHYSICAL_GAMBLING: 'Apostas físicas',
      PROF_SERVICES: 'Serviços profissionais',
      RESTAURANT: 'Restaurante',
      RETAIL: 'Varejo',
      TRAVEL: 'Viagens',
    };
    return map[raw] || raw;
  };

  const resolveMetaProxyEndpoint = () => {
    const fromEnv = (import.meta as any)?.env?.VITE_META_PROXY_ENDPOINT;
    if (fromEnv) return String(fromEnv);
    try {
      const host = String(window.location.hostname || '').toLowerCase();
      if (host.endsWith('.vercel.app') || host === 'vercel.app' || host.includes('vercel')) {
        return '/api/meta-proxy';
      }
    } catch {
      // ignore
    }
    return '/meta-proxy.php';
  };

  const postMetaProxy = async (params: { path: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; query?: Record<string, string>; headers?: Record<string, string>; body?: BodyInit | null }) => {
    const proxyEndpoint = resolveMetaProxyEndpoint();
    const url = new URL(proxyEndpoint, window.location.origin);
    url.searchParams.set('path', params.path);
    if (params.query) {
      for (const [k, v] of Object.entries(params.query)) {
        url.searchParams.set(k, v);
      }
    }
    const method = params.method || 'POST';

    try {
      const doFetch = async (targetUrl: string) => {
        const res = await fetch(targetUrl, {
          method,
          headers: params.headers,
          body: method === 'GET' ? undefined : (params.body ?? null),
        });
        const text = await res.text().catch(() => '');
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        return { res, text, json };
      };

      let { res, text, json } = await doFetch(url.toString());

      const contentType = String(res.headers.get('content-type') || '');
      const looksLikePhpFile =
        contentType.includes('application/x-httpd-php') ||
        contentType.includes('text/x-php') ||
        /^\s*<\?php\b/i.test(text);

      if (res.ok && looksLikePhpFile && proxyEndpoint.includes('meta-proxy.php')) {
        const fallbackUrl = new URL('/api/meta-proxy', window.location.origin);
        fallbackUrl.searchParams.set('path', params.path);
        if (params.query) {
          for (const [k, v] of Object.entries(params.query)) {
            fallbackUrl.searchParams.set(k, v);
          }
        }

        ({ res, text, json } = await doFetch(fallbackUrl.toString()));
      }

      return { ok: res.ok, status: res.status, text, json, headers: res.headers };
    } catch (e: any) {
      throw e;
    }
  };

  const uploadProfilePictureToMeta = async (file: File) => {
    const startRes = await postMetaProxy({
      path: `${META_GRAPH_VERSION}/uploads`,
      query: {
        file_name: file.name,
        file_length: String(file.size),
        file_type: file.type || 'image/jpeg',
      },
    });
    const sessionId = String(startRes?.json?.id || '').trim();
    if (!startRes.ok || !sessionId) {
      const msg = startRes?.json?.error?.message || startRes.text || `Status ${startRes.status}`;
      throw new Error(msg);
    }

    const uploadRes = await postMetaProxy({
      path: `${META_GRAPH_VERSION}/${sessionId}`,
      headers: {
        file_offset: '0',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    const handle = String(uploadRes?.json?.h || '').trim();
    if (!uploadRes.ok || !handle) {
      const msg = uploadRes?.json?.error?.message || uploadRes.text || `Status ${uploadRes.status}`;
      throw new Error(msg);
    }
    return handle;
  };

  const applyLoadedApiOfficialProfile = (profile: any, phoneInfo?: any) => {
    const about = String(profile?.about ?? '').trim();
    const description = String(profile?.description ?? '').trim();
    const address = String(profile?.address ?? '').trim();
    const email = String(profile?.email ?? '').trim();
    const websites = Array.isArray(profile?.websites) ? profile.websites : [];
    const website1 = String(websites?.[0] ?? '').trim();
    const website2 = String(websites?.[1] ?? '').trim();
    const vertical = String(profile?.vertical ?? '').trim().toUpperCase();
    const profilePictureUrl = String(profile?.profile_picture_url ?? '').trim();
    const verifiedName = String(phoneInfo?.verified_name ?? '').trim();
    const displayPhoneNumber = String(phoneInfo?.display_phone_number ?? '').trim();

    setApiOfficialAbout(about);
    setApiOfficialDescription(description);
    setApiOfficialAddress(address);
    setApiOfficialEmail(email);
    setApiOfficialWebsite(website1);
    setApiOfficialWebsite2(website2);
    setApiOfficialCategory(vertical ? vertical : EMPTY_VERTICAL);
    setApiOfficialProfilePictureUrl(profilePictureUrl);
    setApiOfficialPhoto(null);
    setApiOfficialEditMode(false);
    setApiOfficialSnapshot({
      about,
      description,
      address,
      email,
      website1,
      website2,
      vertical,
      profile_picture_url: profilePictureUrl,
      verified_name: verifiedName,
      display_phone_number: displayPhoneNumber,
    });
  };

  const loadApiOfficialProfile = async (apiWhatsappId: string) => {
    if (!apiWhatsappId) return;
    setLoadingApiOfficialProfile(true);
    try {
      const [res, phoneRes] = await Promise.all([
        postMetaProxy({
          method: 'GET',
          path: `${META_GRAPH_VERSION}/${apiWhatsappId}/whatsapp_business_profile`,
          query: {
            fields: 'about,address,description,email,profile_picture_url,websites,vertical',
          },
        }),
        postMetaProxy({
          method: 'GET',
          path: `${META_GRAPH_VERSION}/${apiWhatsappId}`,
          query: {
            fields: 'verified_name,display_phone_number',
          },
        }),
      ]);

      if (!res.ok) {
        const msg = res?.json?.error?.message || res.text || `Status ${res.status}`;
        throw new Error(msg);
      }

      const payload = res?.json;
      let profile: any = null;

      if (Array.isArray(payload?.data)) {
        profile = payload.data[0] ?? null;
      } else if (payload?.data && typeof payload.data === 'object') {
        profile = payload.data;
      } else if (payload && typeof payload === 'object') {
        profile = payload;
      }

      const phonePayload = phoneRes?.ok ? phoneRes?.json : null;

      if (!profile) {
        applyLoadedApiOfficialProfile({}, phonePayload);
        return;
      }
      applyLoadedApiOfficialProfile(profile, phonePayload);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível carregar o perfil da API Oficial.' });
    } finally {
      setLoadingApiOfficialProfile(false);
    }
  };

  useEffect(() => {
    if (!user?.api_oficial) return;
    if (loadingResolvedApiWhatsappId) return;
    const apiWhatsappId = String(resolvedApiWhatsappId || '').trim();
    if (!apiWhatsappId) return;
    loadApiOfficialProfile(apiWhatsappId);
  }, [user?.api_oficial, resolvedApiWhatsappId, loadingResolvedApiWhatsappId]);

  const cancelApiOfficialEdit = () => {
    const snap = apiOfficialSnapshot;
    if (!snap) {
      setApiOfficialEditMode(false);
      return;
    }
    setApiOfficialAbout(snap.about);
    setApiOfficialDescription(snap.description);
    setApiOfficialAddress(snap.address);
    setApiOfficialEmail(snap.email);
    setApiOfficialWebsite(snap.website1);
    setApiOfficialWebsite2(snap.website2);
    setApiOfficialCategory(snap.vertical ? snap.vertical : EMPTY_VERTICAL);
    setApiOfficialProfilePictureUrl(snap.profile_picture_url);
    setApiOfficialPhoto(null);
    setApiOfficialEditMode(false);
  };

  const handleSaveApiOfficialProfile = async () => {
    if (savingApiOfficialProfile) return;
    const apiWhatsappId = String(resolvedApiWhatsappId || '').trim();
    if (!apiWhatsappId) {
      toast({ title: 'Erro', description: 'ID da API do WhatsApp não configurado para este usuário.' });
      return;
    }

    const snap = apiOfficialSnapshot;
    if (!snap) {
      toast({ title: 'Erro', description: 'Perfil ainda não foi carregado. Tente novamente.' });
      return;
    }

    const ALLOWED_VERTICALS = new Set([
      'ALCOHOL',
      'AUTO',
      'BEAUTY',
      'APPAREL',
      'EDU',
      'ENTERTAIN',
      'EVENT_PLAN',
      'FINANCE',
      'GROCERY',
      'GOVT',
      'HOTEL',
      'HEALTH',
      'NONPROFIT',
      'ONLINE_GAMBLING',
      'OTC_DRUGS',
      'PHYSICAL_GAMBLING',
      'PROF_SERVICES',
      'RETAIL',
      'TRAVEL',
      'RESTAURANT',
      'OTHER',
      'MATRIMONY_SERVICE',
    ]);

    const normalizeVertical = (v: string) => {
      const raw = String(v || '').trim().toUpperCase();
      if (raw === EMPTY_VERTICAL) return '';
      if (raw === 'EDUCATION') return 'EDU';
      if (raw === 'ENTERTAINMENT') return 'ENTERTAIN';
      return raw;
    };

    const about = apiOfficialAbout.trim();
    const description = apiOfficialDescription.trim();
    const address = apiOfficialAddress.trim();
    const email = apiOfficialEmail.trim();
    const website1 = apiOfficialWebsite.trim();
    const website2 = apiOfficialWebsite2.trim();
    const category = normalizeVertical(apiOfficialCategory);

    const emailLooksValid = (value: string) => /^\S+@\S+\.\S+$/.test(value);
    if (email && !emailLooksValid(email)) {
      toast({ title: 'Atenção', description: 'E-mail inválido.' });
      return;
    }

    const normalizeWebsite = (value: string) => value.trim();
    const websites: string[] = [];
    const w1 = normalizeWebsite(website1);
    const w2 = normalizeWebsite(website2);
    if (w1) websites.push(w1);
    if (w2) websites.push(w2);
    const urlLooksValid = (value: string) => /^https?:\/\//i.test(value);
    for (const w of websites) {
      if (!urlLooksValid(w)) {
        toast({ title: 'Atenção', description: 'O site deve começar com http:// ou https://.' });
        return;
      }
      if (w.length > 256) {
        toast({ title: 'Atenção', description: 'O site pode ter no máximo 256 caracteres.' });
        return;
      }
    }

    if (category && !ALLOWED_VERTICALS.has(category)) {
      toast({ title: 'Atenção', description: 'Categoria inválida. Selecione uma opção da lista.' });
      return;
    }

    setSavingApiOfficialProfile(true);
    try {
      const endpointPath = `${META_GRAPH_VERSION}/${apiWhatsappId}/whatsapp_business_profile`;

      if (apiOfficialPhoto) {
        const profilePictureHandle = await uploadProfilePictureToMeta(apiOfficialPhoto);
        const photoPayload: any = {
          messaging_product: 'whatsapp',
          profile_picture_handle: profilePictureHandle,
        };

        const photoRes = await postMetaProxy({
          path: endpointPath,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(photoPayload),
        });

        if (!photoRes.ok) {
          throw new Error('Falha ao atualizar a foto na Meta.');
        }
      }

      const infoPayload: any = { messaging_product: 'whatsapp' };

      if (about !== snap.about) {
        if (!about) {
          toast({ title: 'Atenção', description: 'O campo "Sobre" não pode ficar vazio.' });
          setSavingApiOfficialProfile(false);
          return;
        }
        if (about.length > 139) {
          toast({ title: 'Atenção', description: 'O campo "Sobre" pode ter no máximo 139 caracteres.' });
          setSavingApiOfficialProfile(false);
          return;
        }
        infoPayload.about = about;
      }

      if (description !== snap.description) infoPayload.description = description;
      if (address !== snap.address) infoPayload.address = address;
      if (email !== snap.email) infoPayload.email = email;

      const websitesChanged = website1 !== snap.website1 || website2 !== snap.website2;
      if (websitesChanged) infoPayload.websites = websites;

      if (category !== snap.vertical) infoPayload.vertical = category;

      const hasAnyInfoField = Object.keys(infoPayload).length > 1;
      if (hasAnyInfoField) {
        const infoRes = await postMetaProxy({
          path: endpointPath,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(infoPayload),
        });

        if (!infoRes.ok) {
          throw new Error('Falha ao atualizar as informações na Meta.');
        }
      }

      toast({ title: 'Salvo', description: 'Perfil da API Oficial atualizado com sucesso.' });
      await loadApiOfficialProfile(apiWhatsappId);
    } catch {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar o perfil.' });
    } finally {
      setSavingApiOfficialProfile(false);
    }
  };

  return {
    apiOfficialPhoto,
    setApiOfficialPhoto,
    apiOfficialCategory,
    setApiOfficialCategory,
    apiOfficialAbout,
    setApiOfficialAbout,
    apiOfficialDescription,
    setApiOfficialDescription,
    apiOfficialAddress,
    setApiOfficialAddress,
    apiOfficialEmail,
    setApiOfficialEmail,
    apiOfficialWebsite,
    setApiOfficialWebsite,
    apiOfficialWebsite2,
    setApiOfficialWebsite2,
    apiOfficialProfilePictureUrl,
    setApiOfficialProfilePictureUrl,
    loadingApiOfficialProfile,
    setLoadingApiOfficialProfile,
    apiOfficialEditMode,
    setApiOfficialEditMode,
    apiOfficialDialogOpen,
    setApiOfficialDialogOpen,
    apiOfficialPreferredDdd,
    setApiOfficialPreferredDdd,
    sendingApiOfficialWebhook,
    setSendingApiOfficialWebhook,
    startingCreateApiOfficialFlow,
    setStartingCreateApiOfficialFlow,
    loadingSalvyAreaCodes,
    setLoadingSalvyAreaCodes,
    salvyAreaCodes,
    setSalvyAreaCodes,
    apiOfficialSnapshot,
    setApiOfficialSnapshot,
    savingApiOfficialProfile,
    setSavingApiOfficialProfile,
    resolvedApiWhatsappId,
    setResolvedApiWhatsappId,
    loadingResolvedApiWhatsappId,
    setLoadingResolvedApiWhatsappId,
    sendingIntegrateApiOfficialWebhook,
    setSendingIntegrateApiOfficialWebhook,
    resolveSalvyProxyEndpoint,
    loadSalvyAreaCodes,
    handleOpenApiOfficialDialog,
    handleStartCreateApiOfficial,
    hasSalvyId,
    hasWabaId,
    handleSubmitApiOfficialWebhook,
    handleIntegrateApiOfficial,
    META_GRAPH_VERSION,
    EMPTY_VERTICAL,
    verticalLabel,
    resolveMetaProxyEndpoint,
    postMetaProxy,
    uploadProfilePictureToMeta,
    applyLoadedApiOfficialProfile,
    loadApiOfficialProfile,
    cancelApiOfficialEdit,
    handleSaveApiOfficialProfile,
  };
};

export type ApiOficialCtx = ReturnType<typeof useApiOficial>;
