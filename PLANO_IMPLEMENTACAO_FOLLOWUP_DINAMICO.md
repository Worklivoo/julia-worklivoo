# Plano de Implementação — FollowUp Dinâmico (Contratação + Pagamento PIX + Ativação Automática)

**Projeto:** PAINEL WORKLIVOO V2
**Arquivos envolvidos:** `src/pages/settings/FollowUpDinamicoTab.tsx` (alterações), novo(s) arquivo(s) Edge Function (webhook ASAAS), package.json, types, localStorage e rotas ASAAS MCP
**Data:** 2026-08-18
**Regra de preços (Opção 1):** Essencial R$ 5,00 | Pro R$ 6,00 | Empresarial R$ 7,00

---

## 0. Premissas gerais / Tabelas e constantes

### Tabela `usuarios_v2` – campos usados
- `id_assinatura_asaas` – ID da assinatura recorrente (sub_xxx)
- `id_cliente_asaas` – ID do cliente (cus_xxx) – obrigatório para gerar cobrança PIX vinculada)
- `user_valor_mensal` – valor mensal atual da assinatura (será somado ao valor cheio do plano)
- `followup_dinamico` – boolean (ativação da funcionalidade)
- `dia_vencimento` – text (número do dia de vencimento da assinatura – usado para rateio)

### Preços dos planos (Opção 1)
| Plano | ID | Volume / mês | Preço mensal |
|---|---|---|---|
| Essencial | essencial | 500 envios | R$ 5,00 |
| Pro (Mais escolhido) | pro | 1.500 envios | R$ 6,00 |
| Empresarial | empresarial | 5.000 envios | R$ 7,00 |

### Convenções de log obrigatórias
- **TODOS os passos de pipeline de pagamento usam **Correlation ID = `externalReference`** no formato:
```
FU_DINAMICO_[USER_ID]_[TIMESTAMP_UNIX_SEGUNDOS]
Ex.: FU_DINAMICO_user123_1723994000
```
- **Todos os `console.log`** começam com o padrão:
  `[FU Dinamico - ${externalReference}] [${ETAPA}] ...`
- **Todos os valores enviados para API ASAAS são EM CENTAVOS (integer)**. Jamais envie decimal/float. Ex.: R$4,75 => `value: 475`.
- **Idempotência no ASAAS:** Header `idempotency-key: ${externalReference}` em todo POST `/payments`.

---

## Etapa 1) Ajuste dos dados de plano + localStorage types e retomada do fluxo (Frontend — FollowUpDinamicoTab.tsx)
✅ **Objetivo:** Preparar estado para gerar a cobrança e persistir a sessão de pagamento.

- **Passo 1.1 — Atualizar array `plans`
  - Alterar os `preco` dos 3 planos para 5, 6, 7 respectivamente.
  - Manter a ordenação Essencial, Pro (recomendado), Empresarial.
  - Log no console ao inicial:
    `[FU Dinamico Init] Planos carregados: [plans.map(p => p.id + ' ' + p.preco)]`

- **Passo 1.2 — Definir Type do objeto de sessão de pagamento (TypeScript interface `FollowUpDinamicoPagamento` no topo do arquivo:
  - paymentId, externalReference, status, planoId, valorRateio, valorPlanoCheio, valorProxFatura, ciclo (inicio/fim/diaVenc/diasRestantes), pix (payload, base64, qrCodeImageUrl, expirationDate), createdAt, lastPolledAt, completedAt, dadosCliente (nome, empresa opcional)

- **Passo 1.3 — Helpers de localStorage
  - Criar duas funções utilitárias **no arquivo do componente (topo do componente):
  - `getStorageKey(userId) => fu_dinamico_pagamento_${userId}`
  - `savePagamentoToStorage(userId, data) => salva JSON.stringify`.
  - `loadPagamentoFromStorage(userId) => retorna o JSON.parse ou null; em caso de expiração/JSON inválido.
  - `clearPagamentoFromStorage(userId) => removeItem`.
  - Em TODAS as funções, log:
    - `[FU Dinamico Storage] save key=${key} op=save|load|clear payload=...`

- **Passo 1.4 — `useEffect` de retomada ao montar
  - Após o `useEffect` de load config, carrega o storage.
  - Regras de retomada:
    - `Se objeto existir e status === 'RECEIVED' ou `completedAt !== null` => limpa storage.
    - Se existir, status=PENDING, createdAt < agora - 24h => expirado → limpa.
    - Senão (PENDING e não expirado → **restaura estados do storage:
      - setSelectedPlanId = planoId
      - Seta acquireStep = 3 (QR Code
      - Abre Dialog isAcquireDialogOpen = true.
    - Log:
      - `[FU Dinamico Restore] Storage encontrado: status=${status}. Prosseguindo passo 3 (QR Code).`
      - Ou:
      - `[FU Dinamico Restore] Nenhum storage encontrado, seguindo fluxo normal.`

---

## Etapa 2) Botão Gerar QR Code + PDF Pagamento + Persistência Storage (Frontend — FollowUpDinamicoTab.tsx)
✅ **CONCLUÍDA 100% — 18/08/2026**  
**Objetivo:** Implementar fluxo completo de geração de QR, persistência no storage e PDF do pagamento, com toda a estrutura pronta para conectar na Edge Function nas próximas etapas.

### Status da etapa
✅ **Passo 2.1 — Layout 2 estados no passo 3 (100%):**
  - **Estado INICIAL (`pagamentoAtivo === null`) — Exibe card com 2 colunas:**
    - **Esquerda:** selo "Pagamento instantâneo via PIX", placeholder QR, valor R$ rateio em verde, **botão grande amarelo #EBF57D "Gerar QR Code PIX (R$ XX,XX)"** com `disabled={isCreatingQrCode}` + spinner nativo.
    - **Direita:** Resumo da contratação completo (Volume, Ciclo, Dias restantes, Valor hoje, Próxima fatura) + 2 bullets explicativos (PIX hoje / valor cheio recorrente).
  - **Estado PÓS GERAÇÃO (`pagamentoAtivo !== null`) — Exibe:**
    - **Esquerda:** selo verde "Pagamento PIX gerado — aguardando confirmação", imagem QR (se base64/qrCodeUrl), valor, vencimento, **2 botões outline ("Copiar código PIX" e "📄 Baixar PDF do Pagamento")**, payload PIX formatado com quebras de 48 chars em caixa mono, referência `externalReference` abaixo.
    - **Direita:** Resumo do pagamento (8 linhas detalhadas: plano, volume, ciclo, dias, método, valor hoje, valor mensal, próxima fatura) + 2 observações destaque em fundo verde/âmbar.
  - **Rodapé do diálogo:** Botão "Voltar" à esq; à dir botão ghost dinâmico ("Cancelar" se ainda não gerou, "Fechar e pagar depois" se já gerou) + botão amarelo "Já paguei, quero ativar" visível SOMENTE após geração.

✅ **Passo 2.2 — Função `handleGerarQrCode` (100% concluída com estrutura completa):**
  - **Guard clauses implementadas e testáveis:**
    - `!settingsOwnerUserId` → toast erro usuário não identificado.
    - `!user.id_cliente_asaas` (trim + falsy check) → `console.error [FU Dinamico ASAAS] Guard clause: id_cliente_asaas ausente` + toast explicativo.
    - `!user.id_assinatura_asaas` → idem ao anterior.
  - **Padronização de segurança e rastreabilidade:**
    - `correlationId = FU_DINAMICO_[USER_ID]_[TS_MS]`
    - `externalReference = FU_DINAMICO_[USER_ID]_[TS_UNIX_SEGUNDOS]` (padrão do documento).
    - `idempotency-key = correlationId` (usar no header da chamada real na Edge Function).
    - `valorRateioCentavos = Math.round(Number(planoProrrateado.valorRateio) * 100)` + logs separados de centavos vs decimal.
  - **Logs detalhados em `console.groupCollapsed`:**
    - Imprime correlationId, externalReference, user_id, IDs Asaas, plano selecionado, valores calculados (decimal + centavos), dados do ciclo, payload montado para a Edge Function (customer, billingType, value, dueDate, externalReference, description) e idempotency-key.
  - **Chamada real estruturada (pronta para ETAPA 3 a 5):**
    - Comentários no código explicando o fluxo alvo: `supabase.functions.invoke('criar-pagamento-fu-dinamico', { body })` → Edge Function cria cobrança no Asaas → retorna `{ paymentId, pixPayload, pixBase64, qrCodeImageUrl, expirationDate }`.
    - **MOCK válido no lugar da chamada real** (delay 1.2s para simular latência, paymentId `pay_mock_fu_xxx`, payload PIX formatado, expirationDate 30min) para permitir teste completo do UX/UI sem a Edge Function pronta.
  - **Persistência e tratamento de erro:**
    - Sucesso → constrói objeto `FollowUpDinamicoPagamento` completo → `savePagamentoToStorage()` → `setPagamentoAtivo()` → toast sucesso → `console.info` final.
    - Erro → `console.error` com correlationId → toast erro → `setPagamentoAtivo(null)` → finally `setIsCreatingQrCode(false)`.
  - **Ajuste extra no useEffect de retomada:** Além de setar `selectedPlanId/step/dialog`, também **seta `pagamentoAtivo` com o objeto do storage** (antes faltava isso → o passo 3 abria mas não carregava os dados do QR).

✅ **Passo 2.3 — Funções auxiliares e PDF (100% concluída sem novas libs):**
  - **Abordagem nativa escolhida:** Confirmado via `package.json` que `jspdf` e `html2canvas` **NÃO** estão instalados. Para evitar adicionar dependências, optou-se por **nova janela HTML (width=820 / A4 virtual) + botão nativo "Imprimir / Salvar como PDF" via `window.print()` do navegador**.
  - **Função `handleCopiarPixPayload`:** Usa `navigator.clipboard.writeText(pagamentoAtivo.pix.payload)` → toast sucesso + log `[FU Dinamico PIX] Copiar payload OK`. Tratamento de erro fallback por permissão.
  - **Função `handleDownloadPagamentoPdf` completa:**
    - `correlationId = PDF_[externalReference]_[TS]` + `console.info` inicial `[FU Dinamico PDF] Iniciando geracao...`.
    - **Tratamento pop-up bloqueado:** Se `window.open` retornar null, toast de alerta.
    - **Layout A4 virtual:**
      - Cabeçalho WorkLivoo (logo "W" gradiente + nome empresa + selo "Comprovante de Pagamento PIX" azul).
      - Título + sub explicando envio ao financeiro.
      - **2 colunas (Grid 1:1):**
        - **Esquerda (Dados):** Cliente, Empresa, Plano, Valor plano/mês, Ciclo, Dias restantes, Próxima fatura, ID cobrança, Referência, Emissão, Vencimento (linhas pontilhadas entre items).
        - **Direita (QR):** QR box com imagem base64 (ou placeholder "QR não disponível" se vazio), VALOR TOTAL em verde R$, label ativação, botão amarelo "Copiar código PIX" na janela, payload PIX em caixa mono preta com quebras a cada 44 chars.
      - Observação em fundo âmbar com instruções de pagamento + armazenamento de protocolo.
      - Rodapé com data geração e correlationId.
      - Botões **não-imprimíveis**: "Imprimir / Salvar como PDF" (onclick=window.print) e "Fechar".
    - **Logs:** Após abrir janela → `console.info [FU Dinamico PDF] Janela aberta... suggestedFileName=...`.
    - **Tratamento de erro:** catch + toast de erro.
    - **Spinner de loading:** `isGeneratingPdf` desabilita o botão durante a montagem.

### Observações ETAPA 2
- **Texto da UI:** Toda acentuação portuguesa foi aplicada em strings de interface (apenas variáveis técnicas permanecem sem acento, conforme regras).
- **Segurança:** Nenhum access_token do Asaas foi hardcoded no frontend. Todo o comentário de integração indica que a Edge Function é quem deve armazenar o token.
- **Validação TypeScript:** Arquivo validado via `GetDiagnostics` → **0 erros / 0 warnings**.
- **UX geral:** Diálogo continua com `max-h-[92vh]` fixo + scroll interno em `flex-1`.

---

## Etapa 3) Polling de status + UI de sucesso animada + refresh de configuração (Frontend — FollowUpDinamicoTab.tsx)
✅ **CONCLUÍDA 100% — 18/08/2026**  
**Objetivo:** Feedback visual em tempo real da confirmação do pagamento e sincronização com a tela ativa após fechamento. **IMPORTANTE:** NÃO atualizamos banco nem API Asaas aqui. FONTE DA VERDADE = WEBHOOK das ETAPAS 4-5.

### Status da etapa
✅ **Passo 3.1 — Estados novos:** Adicionados `isPollingPagamento` (bool, controle visual do selo) e `pagamentoConfirmadoUI` (bool, overlay de sucesso quando RECEIVED), além das funções novas:
  - **`reloadFollowupDinamicoConfig()`:** Refaz `SELECT ... FROM usuarios_v2` de `followup_dinamico`, `followup_dinamico_volume` e `followup_dinamico_dias_perdidos` e atualiza os estados locais. Essa função é chamada 3 segundos após a confirmação do pagamento para trocar a tela de aquisição pelo layout ativo (caso webhook já tenha rodado). Logs `[FU Dinamico Refresh]`.

✅ **Passo 3.2 — Função `pollStatusPagamentoOnce(pagamento)` estruturada e pronta para Edge Function:**
  - Log inicial `[FU Dinamico Polling] correlationId=POLL_[externalReference]_[TS]` + `pagamento_id`.
  - **Fluxo real (ETAPAS 4-7) documentado inline:** chamada via `supabase.functions.invoke('poll-pagamento-fu-dinamico', { body: { paymentId, externalReference } })` → Edge faz GET `/v3/payments/{id}` no Asaas (protegendo token) → retorna status seguro.
  - **MOCK controlado para teste de UX:** Se `idadeSegundos >= 45s` desde `createdAt` → status vira `RECEIVED` AUTOMATICAMENTE no MOCK (com warn amarelo no console). Isso permite validar TODO o overlay animado, barra de progresso, toast, refresh e fechamento automático SEM PRECISAR PAGAR DE VERDADE nem ter webhook pronto. Delay de rede 300ms.
  - Retorna `{ novoStatus, rawResponse }`.

✅ **Passo 3.3 — useEffect polling com `setInterval 3000ms` + cleanup robusto:**
  - Guard clauses NO TOPO: só roda SE `isAcquireDialogOpen && acquireStep===3 && pagamentoAtivo && status===PENDING && !pagamentoConfirmadoUI`.
  - Log INICIAL mostrando pagamento_id + externalReference + "Intervalo=3s".
  - Primeiro tick dispara IMEDIATAMENTE (`tick()` fora do setInterval, user não espera 3s).
  - A cada tick: tenta ++, chama `pollStatusPagamentoOnce`, atualiza `lastPolledAt` e `status` no objeto, **salva no localStorage a cada ciclo**, atualiza `pagamentoAtivo` via `setPagamentoAtivo`.
  - **Se RECEIVED:** `console.groupCollapsed 🎉` com todos os dados + observação GRAVE ">>> NÃO atualizamos tabela NEM API Asaas aqui. A FONTE DA VERDADE É O WEBHOOK" → seta `completedAt` → salva storage → `setPagamentoConfirmadoUI(true)` → para polling → toast 🎉 Pagamento confirmado.
  - **3 segundos após RECEIVED (setTimeout):** Fecha dialog, limpa step/planoSelecionado, limpa `pagamentoConfirmadoUI`, **limpa storage de pagamento com `clearPagamentoFromStorage`** (não queremos lixo de pagamentos concluídos) → **chama `reloadFollowupDinamicoConfig()`** para sincronizar tela.
  - **Se CANCELLED/EXPIRED:** Para polling, limpa storage, warn no console.
  - **Cleanup (return do useEffect):** `cancelled=true`, `clearInterval(id)`, `clearTimeout(auto)`, seta `isPollingPagamento(false)`, log `[FU Dinamico Polling] Cleanup: parado (...)`.
  - **Dependências corretas (não rodam infinitamente):** `[isAcquireDialogOpen, acquireStep, pagamentoAtivo?.paymentId, pagamentoAtivo?.status, settingsOwnerUserId, pagamentoConfirmadoUI]`.

✅ **Passo 3.4 — UI Selo de polling dinâmico (1ª linha do card QR):**
  - **Se `RECEIVED`**: selo VERDE "Pagamento confirmado" (bolinha verde sólida).
  - **Else se `isPollingPagamento`**: selo AZUL INDIGO "Verificando pagamento em tempo real..." com bolinha `animate-ping` dupla (efeito pulso contínuo ao vivo durante o polling).
  - **Else (nenhum polling ainda, só inicialização rara)**: selo verde "Pagamento PIX gerado — aguardando confirmação".

✅ **Passo 3.5 — Overlay ANIMADO DE SUCESSO (sobre todo o grid do passo 3, `z-20 absolute inset-0`) quando `pagamentoConfirmadoUI === true`:**
  - Fundo `bg-gradient-to-br from-emerald-50/95 via-white/95 to-emerald-50/95` + `backdrop-blur-sm` + animações `animate-in fade-in zoom-in-95` (500ms).
  - **Ícone Check verde:** círculo `h-20 w-20` gradiente emerald + `shadow-xl` + `animate-ping` atrás + SVG polyline 20,6 9,17 4,12 (símbolo de ✓) com atraso 300ms e slide-in-from-bottom.
  - **Título:** "Pagamento recebido!" `text-2xl font-bold emerald-900`.
  - **Texto suporte:** "O PIX foi confirmado. Estamos preparando a sua ativação. Essa janela será fechada automaticamente em alguns segundos."
  - **Barra de progresso de 0% a 100% em EXATAMENTE 3s:** keyframe `fu-progress-bar` inline via `<style>` (não depende de animações customizadas do tailwind.config) + classe `.fu-progress-fill` com `animation: fu-progress-bar 3s linear forwards;`. Barra gradiente emerald-400→600 em container `bg-emerald-200/80`.

✅ **Passo 3.6 — Refresh configuração pós-confirmação:** `reloadFollowupDinamicoConfig()` faz refetch do usuarios_v2 e atualiza os estados de `followupDinamicoAtivo / volume / dias_perdidos` imediatamente após fechamento do Dialog. Se o webhook já processou → a página de aquisição desaparece e mostra o layout ativo instantaneamente.

### Observações ETAPA 3
- **MOCK para testar:** Basta gerar um QR, deixar o dialog aberto e aguardar ~45 segundos → automaticamente o MOCK vira RECEIVED, mostra a animação verde, fecha sozinho e recarrega a config.
- **GetDiagnostics:** 0 erros / 0 warnings.
- **Segurança reforçada:** Console `groupCollapsed` de confirmação contém aviso GRAVE de que NÃO atualizamos nada no frontend; TUDO depende do webhook.

---

## Etapa 4) Preparação Infra Webhook + Segurança (Edge Function ASAAS)
✅ **CONCLUÍDA 100% — 18/08/2026**

Pasta criada: `supabase/functions/`
Arquivos de suporte:
- `import_map.json` — global para todas as edges (resolve imports Deno std http/server.ts)
- `.env.example` — template com TODOS os secrets necessários (nunca versionar valores reais)

### 4.1 Validação de segurança (implementada NO TOPO do handler):
- **Header obrigatório recebido do Asaas:** `asaas-access-token` (comparado com `Deno.env.get('ASAAS_WEBHOOK_SECRET')`).
- **Falha:** resposta `401 unauthorized` com `console.groupCollapsed` contendo header recebido mascarado vs secret esperado mascarado.
- **Secrets obrigatórios no início da execução:** retorna `500 missing_config` se ASAAS_WEBHOOK_SECRET, ASAAS_ACCESS_TOKEN, SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY estiverem vazios.
- **Filtro de evento:** aceita `PAYMENT_RECEIVED` **ou** `PAYMENT_CONFIRMED` (nomenclatura varia por ambiente Asaas). Evento não reconhecido → retorna 200 com `processed=false` (não causa retry do Asaas).
- **Filtros de seguranção adicionais:** `billingType` deve ser `PIX` (ignora boleto/cc), `status` do pagamento deve ser RECEIVED/CONFIRMED, `externalReference` deve começar com **`FU_DINAMICO_`** (proteção contra webhook de outros produtos do Asaas da WorkLivoo).

---

## Etapa 5) Pipeline de atualização confiável (WEBHOOK = FONTE DA VERDADE)
✅ **CONCLUÍDA 100% — 18/08/2026**

Implementado em: [asaas-webhook-followup-dinamico/index.ts](file:///c:/Users/rodri/Documents/WORKLIVOO/PAINEL%20WORKLIVOO%20V2/supabase/functions/asaas-webhook-followup-dinamico/index.ts)

### Ordem de execução (implementada RIGOROSAMENTE como planejado):
Cada etapa tem **correlationId = WH_FU_[TIMESTAMP]** + `console.groupCollapsed` / `console.info` detalhados.

**Step 1/5 — Parse externalReference e dados user:**
- Padrão `FU_DINAMICO_[USER_ID]_[TIMESTAMP]`. Usa split e pega `partes.slice(2, -1).join('_')` para aceitar `user_id` com underscores.
- Valor do pagamento recebido em **centavos** (`value` ou `netValue`).
- Inferência do plano: tenta match na description (regex `/plano\s+(essencial|pro|empresarial)/`), se não der, inferência pelo valor pago (>= 20% do menor plano). Preços: essencial=5, pro=6, empresarial=7 (igual frontend).
- **SELECT usuarios_v2 por user_id:** retorna 404 se não encontrado. Armazena `userValorMensalAtual`, `followupDinamicoAtual`, `idClienteAsaas`, `idAssinaturaAsaas`.

**Step 2/5 — GUARD CLAUSE anti dupla ativação:**
- **SE `followupDinamicoAtual === true` → retorna 200 imediatamente com `processed=false; guard_clause=already_active`** e `console.warn` claro.
- **Motivo:** evitar dupla soma em `user_valor_mensal` se o Asaas disparar o webhook 2x (evento PAYMENT_RECEIVED + PAYMENT_CONFIRMED) ou se frontend marcar RECEIVED por polling antes do 1o webhook.

**Step 3/5 — Cálculo novoValorMensal + UPDATE usuarios_v2 (ORDINALMENTE PRIMEIRO):**
- `novoValorMensalReais = userValorMensalAtual + precoPlanoReais`, arredondado em 2 decimais via `toFixed`.
- **UPDATE SUPABASE via REST (`PATCH /rest/v1/usuarios_v2?user_id=eq.X`) usando SERVICE_ROLE_KEY (não usa anon key!).**
- Campos atualizados:
  - `user_valor_mensal = novoValorMensalReais`
  - `followup_dinamico = true`
  - `followup_dinamico_volume`: se usuário já tinha algum valor mantém; senão preenche default (500/1500/5000 por plano) para a UI exibir barra correta pós-ativação.
- Fail do update: aborta pipeline com 500 (não toca Asaas se banco quebrou — garante consistência).

**Step 4/5 — DELETAR cobranças FUTURAS PENDENTES da assinatura:**
- `GET /v3/subscriptions/{id_assinatura_asaas}/payments?status=PENDING&expectedPaymentDateGreaterThan=HOJE`
- Para **cada cobrança retornada**: `DELETE /v3/payments/{id}` individual.
- **Tratamento de erro NÃO FATAL:** se uma cobrança não puder ser deletada (ex: já liquidada), faz `console.warn` **e continua o pipeline**; não aborta pois banco já foi salvo.
- Se `id_assinatura_asaas` estiver ausente: warn no console, pula etapa.

**Step 5/5 — PATCH valor da assinatura recorrente no Asaas:**
- `PATCH /v3/subscriptions/{id_assinatura_asaas}` com body `{ value: novoValorMensalReais }` (A API de PATCH de assinatura do Asaas espera o valor em REAIS com casas decimais, não centavos; comentário inline explicando essa diferença importante). Caso PATCH não seja aceito em algum ambiente, documentado trocar para PUT.
- Tratamento NÃO FATAL de erro: loga `ERRO (NÃO FATAL se banco já estiver salvo)` para não derrubar a resposta. O dado do banco é verdade e o ajuste manual da assinatura pode ser feito depois.

### Resposta final (200):
Retorna `correlationId`, `totalMs`, e o resumo `resultado` contendo `user_valor_mensal_de`, `user_valor_mensal_para`, `followup_dinamico=true`, `plano_id`, `novo_valor_assinatura_asaas_centavos` (audit).

---

### ETAPA 4.3 BÔNUS: Edges auxiliares `criar-pagamento-fu-dinamico` e `poll-pagamento-fu-dinamico`
Já que no frontend (ETAPA2/3) tínhamos deixado estruturado `supabase.functions.invoke('criar-pagamento-fu-dinamico', { ... })` e `invoke('poll-pagamento-fu-dinamico', { ... })`, ambas foram criadas 100%:

1. **[criar-pagamento-fu-dinamico/index.ts](file:///c:/Users/rodri/Documents/WORKLIVOO/PAINEL%20WORKLIVOO%20V2/supabase/functions/criar-pagamento-fu-dinamico/index.ts)**
   - Valida **JWT do Supabase via decode manual do payload JWT (pegando sub/role)**. Bloqueia se role=anon ou sem usuário.
   - Valida que `customerId` enviado pelo frontend **EXATAMENTE BATE com `usuarios_v2.id_cliente_asaas` do dono da sessão** (403 customer_mismatch se usuário tentar usar o ID de cliente de outro usuário). Impede burlar cobrança na conta de terceiro.
   - Valida `externalReference` obrigatório começar com `FU_DINAMICO_`.
   - Header `idempotency` do request do frontend repassa ao Asaas (header `idempotency` no POST /payments), evita dupla cobrança em clique duplo/recarga.
   - Primeiro `POST /v3/payments` (billingType=PIX, dueDate=hoje, externalReference, description, postalService=false).
   - Depois `GET /v3/payments/{id}/pixQrCode` → retorna ao frontend `{ pixPayload, pixBase64, qrCodeImageUrl, expirationDate }`. Se endpoint de QRCode falhar, tenta extrair do próprio body do /payments response (fallback robusto).
   - Resposta `201 Created` + plano, pagamento e pix.

2. **[poll-pagamento-fu-dinamico/index.ts](file:///c:/Users/rodri/Documents/WORKLIVOO/PAINEL%20WORKLIVOO%20V2/supabase/functions/poll-pagamento-fu-dinamico/index.ts)**
   - Valida JWT usuário.
   - Segurança: **externalReference recebido tem que começar com `FU_DINAMICO_[CALLING_USER_ID]_`** (usuário A nunca consulta pagamento do usuário B).
   - Consulta Asaas `/v3/payments/{id}` ou lista por externalReference.
   - Normaliza status: CONFIRMED→RECEIVED, OVERDUE→EXPIRED, DELETED→CANCELLED (evita ambiguidades).
   - Retorna apenas: `{ status, statusAsaas, paymentId, externalReference, updatedAt, netValue }`. Nunca retorna payload PIX nem dados sensíveis do Asaas no polling.

---

## Etapa 6) Refresh do usuário no FRONTEND (após confirmação — FollowUpDinamicoTab.tsx)
✅ **CONCLUÍDA 100%** (Implementada na **ETAPA3**)
- `reloadFollowupDinamicoConfig()` roda 3 segundos após a animação verde.
- Refaz `SELECT usuarios_v2 (followup_dinamico, followup_dinamico_volume, followup_dinamico_dias_perdidos) WHERE user_id=settingsOwnerUserId` usando o cliente supabase normal.
- Atualiza os 3 estados locais → tela de aquisição some automaticamente e mostra o layout ativo (2 colunas com resumo + configuração de dias).

---

## Etapa 7) Testes manuais Obrigatórios (Checklist)
Seguir a ordem abaixo após deploy das edges e configuração dos secrets no Supabase Dashboard:

### A. Deploy e configuração
- [ ] Configurar os 5 secrets no Dashboard do Supabase (Functions → Secrets): `ASAAS_WEBHOOK_SECRET`, `ASAAS_ACCESS_TOKEN`, `ASAAS_BASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deployar as 3 edges:
  ```bash
  supabase functions deploy asaas-webhook-followup-dinamico --no-verify-jwt
  supabase functions deploy criar-pagamento-fu-dinamico --no-verify-jwt
  supabase functions deploy poll-pagamento-fu-dinamico  --no-verify-jwt
  ```
- [ ] No painel Asaas → Webhooks: apontar URL para `https://SEU-PROJETO.supabase.co/functions/v1/asaas-webhook-followup-dinamico` e definir o header `asaas-access-token` com o MESMO valor de `ASAAS_WEBHOOK_SECRET`.
- [ ] No frontend (FollowUpDinamicoTab.tsx), trocar os MOCKs comentados das funções `handleGerarQrCode` e `pollStatusPagamentoOnce` pelas chamadas reais:
  - `handleGerarQrCode`: trocar o bloco MOCK por `const { data, error } = await supabase.functions.invoke('criar-pagamento-fu-dinamico', { body: {...} })`
  - `pollStatusPagamentoOnce`: trocar o bloco MOCK por `const { data } = await supabase.functions.invoke('poll-pagamento-fu-dinamico', { body: {...} })` e retornar `{ novoStatus: data.status }`

### B. Teste do 0 (usuário followup_dinamico=false):
- [ ] Login com usuário real `followup_dinamico=false` e `cliente_status !== TRIAL` e `api_oficial=true`.
- [ ] Validar que a aba aparece em 1º.
- [ ] Clicar em Adquirir → passo1 selecionar Pro R$6 → passo2 validar rateio calculado corretamente com tooltip → passo3 → Gerar QR.
- [ ] Confirmar request POST chegou em `criar-pagamento-fu-dinamico` e no retorno o console mostra `externalReference = FU_DINAMICO_[USER_ID]_[TIMESTAMP]` + `pagamento_id do Asaas`.
- [ ] Confirmar que `fu_dinamico_pagamento_[USER_ID]` existe no localStorage com status=PENDING.
- [ ] Recarregar página → retomar automaticamente no passo3 do QR (storage loading).
- [ ] Copiar código PIX → toast sucesso.
- [ ] Baixar PDF → janela abre com layout A4, logo WorkLivoo, QR, payload, 2 colunas, botão Imprimir/Salvar como PDF e nome arquivo correto.
- [ ] Pagar o PIX manualmente (ou usar sandbox Asaas marcar como pago).
- [ ] **Confirmar polling:** após ~3s verifica `poll-pagamento-fu-dinamico` retornando RECEIVED.
- [ ] **Confirmar overlay verde aparece, barra 3s roda, dialog fecha e `reloadFollowupDinamicoConfig()` roda.**
- [ ] **Confirmar WEBHOOK rodou:** observar logs de `asaas-webhook-followup-dinamico` no Supabase Dashboard Logs. Ordem deve aparecer: Step 1/5 → Step 3/5 update banco → Step 4/5 delete cobrancas futuras → Step 5/5 PATCH → Pipeline concluído em XXXms.
- [ ] **Confirmar dados finais:**
  - Tabela `usuarios_v2`: `followup_dinamico=true`, `followup_dinamico_volume=1500` (plano Pro), `user_valor_mensal = valor_antigo + 6`.
  - Asaas: assinatura `{id_assinatura_asaas}` → novo valor bate com `novoValorMensalReais`.
  - Asaas: cobranças futuras pendentes ANTERIORES deletadas (não aparecem na listagem).

### C. Teste de guard clause:
- [ ] Pagar 2x o mesmo QR manualmente (webhook PAYMENT_RECEIVED repetido).
- [ ] **Resultado esperado:** 1a vez roda pipeline completo (log success), 2a vez retorna `guard_clause=already_active` (não mexe em nada, nem soma mensalidade). ZERO dupla ativação.

### D. Teste de erros esperados:
- [ ] Usuário sem `id_cliente_asaas`: botão Gerar QR trava nos guards do frontend + toast.
- [ ] Usuário com `id_cliente_asaas` mas sem `id_assinatura_asaas`: idem.
- [ ] Chamar webhook com `asaas-access-token` errado: retorno `401 unauthorized`, NÃO há alteração em banco nem API.
- [ ] Chamar webhook de evento `PAYMENT_CREATED`: retorna 200 `processed=false` sem alterar nada.

---

## Observações / MCP do Asaas (Endpoints)
Confirmados via MCP `mcp_asaas` do projeto e documentação Asaas oficial:
| Ação | Método | Endpoint | Observação |
|---|---|---|---|
| Criar cobrança PIX | POST | `/v3/payments` | Header `idempotency` evita duplicatas. |
| Obter QR Code / payload PIX | GET | `/v3/payments/{id}/pixQrCode` | Retorna `payload`, `encodedImage` (base64), `expirationDate`. |
| Consultar status pagamento | GET | `/v3/payments/{id}` | Ou listar por externalReference. |
| Apagar cobrança pendente | DELETE | `/v3/payments/{id}` | Só funciona com status PENDING/EXPIRED. |
| Listar cobranças pendentes da assinatura | GET | `/v3/subscriptions/{id}/payments?status=PENDING` | Query param `expectedPaymentDateGreaterThan` para filtrar futuras. |
| Atualizar valor da assinatura recorrente | PATCH | `/v3/subscriptions/{id}` | Body `{ value }` em **REAIS**. Se PATCH não for aceito, usar PUT. |
