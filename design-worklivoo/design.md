# Sistema visual Worklivoo

Este arquivo é a fonte da verdade de layout para tudo que a Worklivoo constrói:
site, painéis e produto. Ele descreve o padrão já aprovado — siga-o em vez de
inventar um novo.

`tokens.css` acompanha este arquivo. Importe-o e use as variáveis; nunca escreva
um valor de cor, raio ou espaçamento direto no código.

---

## 1. Fundamentos

### Cor

A paleta é **cinza neutro e preto**, com **um único acento**: o verde-limão
`--lime`.

O limão é pontuação, não tinta. Ele marca a ação principal, o dado que importa
e nada mais. **Se aparecer em mais de dois elementos por tela, está demais.**

Cuidado herdado da marca: os cinzas do manual antigo (`#e6e9e5`, `#14150f`) têm
viés esverdeado. Em tela isso suja o branco e briga com o limão. Use os cinzas
de `tokens.css`, que são neutros de verdade.

### Tipografia

DM Sans em tudo. Três pesos, com papéis fixos:

| Peso | Onde |
|---|---|
| 500 | corpo de texto, descrição, legenda |
| 700 | rótulo, nome, item de lista, botão |
| 800 | título, número em destaque, etiqueta em caixa alta |

Títulos levam espacejamento negativo (`-.02em` a `-.035em`) — quanto maior a
fonte, mais fechado. Etiquetas em caixa alta levam positivo (`.1em` a `.2em`).
Sem isso o texto parece de rascunho.

Escala em uso: 9,5 / 10,5 / 11,5 / 12 / 12,5 / 13 / 13,5 / 14 / 14,5 / 16 / 21 px
e daí títulos com `clamp()`. Não invente tamanhos intermediários.

### Raio de canto

O raio comunica hierarquia. Quanto maior a superfície, maior o canto:

| Raio | Onde |
|---|---|
| `999px` | pílula, etiqueta, avatar |
| 48px | cartão da página inteira |
| 32px | bloco de seção |
| 22px | painel dentro de um card |
| 14px | tile, item de lista |
| 8-10px | botão, campo |

**Nunca arredonde um canto só.** Se usar `border-left` de destaque, o raio vai
a zero. Meio-arredondado sempre parece defeito.

### Movimento

Uma curva em tudo: `--ease`. Transições entre 0,22s e 0,35s.

---

## 2. Composição

### Estrutura da página

Barra flutuante recuada `--nav-inset` das laterais, arredondada só embaixo.
Abaixo dela, o conteúdo vive num cartão de `--radius-card` sobre um fundo que
escurece **só na reta final**, chegando ao preto exatamente onde o rodapé começa.

Não escureça cedo: o cinza claro segura a página quase inteira e a virada
acontece no último quinto. Escurecer no meio parte a página em duas.

### Ritmo

Seções alternam respiro (`--section-y`, ou 72px nas mais curtas) e são separadas
por um fio de `--line-soft`.

Cuidado real: esse fio vem de `.section + .section`. **Qualquer elemento entre
duas seções quebra a regra em silêncio** — inclusive uma âncora vazia
`<div id="...">`. Coloque o `id` na própria seção.

### Alinhamento

Cabeçalho de seção alinhado à esquerda, com largura máxima de ~62 caracteres.
Texto de painel centralizado tem no máximo 740px. Linha longa demais cansa.

---

## 3. Componentes

### Botões

Três variantes, e a escolha entre elas não é estética:

**Limão sólido** — a ação principal. Uma por tela.
**Cinza em vidro** — ação secundária.
**Preto em vidro** — ação dentro de card claro.

```css
.btn{
  display:inline-flex; align-items:center; gap:9px;
  height:47px; padding:0 22px;
  border-radius:9px; border:1px solid transparent;
  font-size:14px; font-weight:700;
  transition:transform .22s var(--ease), background .22s var(--ease);
}
.btn:hover{ transform:translateY(-1px) }
```

O botão sobe 1px ao passar o mouse, e a seta dentro dele anda 3px. Movimento
mínimo, mas é o que dá sensação de resposta.

### Vidro

Usado na barra ao rolar, nos botões secundários e nas pílulas.

```css
.vidro{
  background:rgba(255,255,255,.52);
  -webkit-backdrop-filter:blur(16px) saturate(180%) brightness(1.03);
  backdrop-filter:blur(16px) saturate(180%) brightness(1.03);
  border-color:transparent;
  box-shadow:0 12px 30px -12px rgba(20,20,20,.30);
}
```

**Três erros que já cometemos, não repita:**

1. **Nada de aro branco.** Um `inset 0 0 0 1px rgba(255,255,255,...)` parece dar
   espessura ao vidro, mas sobre fundo claro vira contorno duro e entrega o
   truque. O volume vem do desfoque e da sombra solta, só.
2. **Brilho especular também desenha aro.** Um degradê branco na diagonal que
   encoste na borda arredondada redesenha exatamente o mesmo contorno que você
   acabou de tirar do `box-shadow`. Se usar, faça-o morrer antes da borda.
3. **Cor fiel e vidro puxam em direções opostas.** Acima de ~90% de opacidade
   não sobra transparência para o desfoque atravessar — o efeito custa e não
   aparece. Para superfície colorida da marca, use sólido.

Sempre ofereça reserva:

```css
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .vidro{ background:rgba(255,255,255,.9) }
}
```

### Cards

Fundo `--white`, borda `--line-soft`, e sombra baixa e larga:

```css
box-shadow:0 34px 64px -34px rgba(20,20,20,.45);
```

O deslocamento vertical alto com espalhamento negativo grande é o que faz a
sombra parecer peso, não borrão.

### Cartas empilhadas

Cada card gruda no topo e o seguinte sobe por cima:

```css
.card{ position:sticky }
.card:nth-of-type(1){ top:76px }
.card:nth-of-type(2){ top:88px }
.card:nth-of-type(3){ top:100px }
.card:not(:last-of-type){ padding-bottom:104px }
.card + .card{ margin-top:-60px }
```

Três coisas importam aqui:

- **`position:sticky` morre dentro de qualquer ancestral com `overflow:hidden`.**
  Se não grudar, é isso.
- A margem negativa faz o card seguinte nascer por dentro do anterior. Sem o
  `padding-bottom` extra no card coberto, ela come o conteúdo.
- **Card alto demais tem o rodapé cortado.** Meça: `top` + altura precisa caber
  na janela. Em notebook a área útil é ~713px.

### Trilhos rolantes

Para logotipos e depoimentos:

```css
.trilho{
  overflow:hidden;
  mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);
}
.trilho__track{
  display:flex; gap:18px; width:max-content;
  animation:desliza 64s linear infinite;
}
@keyframes desliza{ to{ transform:translateX(-50%) } }
```

O conteúdo é **duplicado no HTML** — é isso que faz o ciclo fechar sem emenda,
já que a animação anda exatamente metade.

Não pause no passar do mouse em trilho decorativo; pause só onde há texto para
ler.

---

## 4. Desempenho — regras duras

Estas vieram de erro real, com medição antes e depois.

**Fundo é imagem, nunca cálculo por quadro.** Um fundo desenhado por shader
recalcula 2,8 milhões de pixels 60 vezes por segundo numa janela comum, e 8,3
milhões num monitor grande. A rolagem trava enquanto ele está visível. Uma foto
custa zero por quadro e ainda fica melhor.

**Movimento é `transform`, nunca posição.** `transform` roda no compositor e não
dispara recálculo de layout. Para deriva lateral de fundo: deixe a imagem ~20%
mais larga que a caixa e anime `translateX` dentro dessa sobra.

**`backdrop-filter` é barato em área pequena.** Catorze elementos com vidro na
página somam 109 mil pixels — 25 vezes menos que o shader que tiramos. Não tema
usá-lo em botões; pense duas vezes antes de aplicá-lo em algo do tamanho da tela.

**Sempre desligue movimento para quem pediu:**

```css
@media (prefers-reduced-motion: reduce){
  .trilho__track, .fundo-animado{ animation:none }
}
```

---

## 5. Padrão de interface de produto

O site mostra maquetes de painel que **valem como referência para as telas reais
dos produtos**. Reaproveite estes padrões:

**Moldura de janela** — barra superior clara com três pontos, título discreto ao
centro, corpo em `--paper`. Raio de 14px.

**Kanban** — colunas com cabeçalho em caixa alta 11,5px/800, contador à direita,
cartões brancos de raio 11px com nome em 13px/700 e metadado em 12px/500. Cartão
ativo ganha borda `--lime`.

**Conversa** — fiel ao WhatsApp: fundo `#efeae2` com padrão, balão recebido
branco à esquerda, enviado `#d9fdd3` à direita, hora em 11px alinhada ao fim,
cabeçalho com avatar redondo de 32px.

**Tabela de itens** — cabeçalho em caixa alta 10,5px/800 `--muted`, linhas
separadas por `--line-soft`, número alinhado à direita, total em 800.

**Documento gerado** — cartão branco com faixa de cabeçalho, linhas cinza
simulando texto, e o total em destaque. Serve para PDF, proposta e relatório.

Regra geral dessas telas: **densidade alta, contraste baixo, uma cor só de
acento.** É o que faz parecer software de verdade e não maquete.

### Formulários de acesso (login e cadastro)

Criado em `src/styles/worklivoo-auth.css`, a partir dos componentes acima:

- Cartão de formulário: `--white`, raio 32px, sombra de card, cabeçalho à esquerda
  (etiqueta em caixa alta → título 800 → legenda 500). Logo em tile 48px, raio 14px.
- Campo: 47px de altura, raio 10px, fundo `--paper`. Foco = borda `--ink` + halo
  `--line`. **Sem anel de limão**: o limão fica só no botão principal.
- Rótulo em caixa alta 10,5px/800 com `.1em`.
- Botão principal limão; "Validar" e "Voltar" em preto em vidro (card claro).
- Indicador de etapas: duas barras de 4px, ativa em `--ink`.
- **Cor de erro:** a paleta não previa uma. Foi criado `--danger: #b42318`, usado só
  em texto e borda de campo inválido, nunca em fundo.
- **Escopo dos tokens:** o app usa shadcn, onde `--muted` é um triplo HSL. Para não
  quebrar as demais telas, os tokens entram sob `.wl-scope` em vez de `:root`.
  Portais do Radix (menus, diálogos) também precisam da classe `wl-scope`.

### Páginas de produto (Início)

Criado em `src/styles/worklivoo-page.css`, a partir da seção 5:

- **Cartão da página:** `--white`, raio 48px (32px no celular), sombra de card, sobre
  fundo `--paper`. O fundo só escurece nas telas migradas (opt-in via `:has(.wl-page)`).
- **Cabeçalho da página:** etiqueta em caixa alta → título 800 `clamp(30px,4vw,48px)`
  com `-.035em`. O seletor de período fica à direita, em cinza em vidro.
- **Seções:** separadas por fio `--line-soft`, 72px de respiro (40px no celular).
  Nada pode ficar entre duas `.wl-section`.
- **Cartão de dado (`.wl-stat`):** painel 22px em `--paper`, rótulo caixa alta 10,5px/800,
  número 800 com `-.035em`. O dado que importa vira tile `--ink` (`.wl-stat--ink`).
- **Limão no conteúdo:** o menu lateral já é limão, então a página não usa limão
  (gráficos e barras em `--ink`). O único limão extra é o botão "Aplicar" do período.
- **Gráficos:** barras `--ink` com valor escrito em cima, grade `--line`, tooltip preto.
  No celular o funil vira azulejos e a origem vira barras horizontais.
- **Tabela de itens:** cabeçalho 10,5px/800 `--muted`, linhas com `--line-soft`,
  data alinhada à direita; no celular vira lista.
- Setas verdes/vermelhas e selos decorativos foram removidos: não carregavam informação.

### Funil de leads (kanban)

Criado em `src/styles/worklivoo-page.css`, a partir do padrão "Kanban" da seção 5:

- Cartão da página com respiro menor (`.wl-page--board`) para dar largura às colunas.
- **Barra de filtros** de 42px de altura: busca e seletores com fundo `--paper` e fio `--line`;
  o botão de vidro vira "campo" dentro da barra, para tudo parecer uma família só.
- **Coluna:** painel de 22px em `--paper`; cabeçalho caixa alta 11,5px/800 com `.06em`, contador
  à direita em pílula branca. Etiqueta "IA" preta (não limão).
- **Cartão de lead:** branco, raio 11px, sem avatar. Título 13px/700 só com o nome da pessoa (sem
  nome: telefone), pílula de origem, selo "IA pausada" quando a IA está desligada naquele lead, e
  rodapé (fio `--line-soft`) com "Interação há X" (última interação, `update_mensagem`) à esquerda e
  valor/selos à direita. Valor só aparece quando é maior que zero. Perdido = fundo `--stone` + selo;
  vendido = selo preto.
- **Cartão em movimento** ganha borda `--lime`: único limão do quadro (fora o botão "Novo lead").
- Tarefas atrasadas: selo `--danger` com contagem.
- Formulários em diálogo: `.wl-modal` + `.wl-modal__section` (painel `--paper` dentro do diálogo branco).

### Página do lead

Criado em `src/styles/worklivoo-lead.css`:

- **Cabeçalho:** botão de voltar em vidro, etiqueta caixa alta, nome da pessoa como título, pílulas de
  status, etapa e origem. Ação principal "Marcar como venda" em limão; "Marcar como perda" em preto em vidro.
- **Duas colunas:** esquerda com painéis de dados (`.wl-lp-card`: `--paper`, raio 22px), direita com abas.
  Abaixo de 1100px viram uma coluna só.
- **Dados:** rótulo caixa alta 10,5px/800 sobre valor 14px/700; edição inline com campos `.wl-input` brancos.
- **Barra de etapas:** concluídas em `--ink` com check, atual com aro preto, futuras em `--stone`.
- **Abas:** controle segmentado em `--paper`; aba ativa branca. Contador em pílula preta.
- **Conversa:** mantém o visual fiel ao WhatsApp, dentro de moldura de 22px.
- **Anotação e tarefa:** cartões `--paper` de 14px; anotação fixada em `--stone` com selo preto;
  tarefa com caixa de seleção preta e selo de estado (concluída preta, atrasada `--danger`).
- Ação destrutiva usa `.wl-btn--danger`; "Adicionar" das abas é preto em vidro (o limão é só do cabeçalho).

### Conversas

Criado em `src/styles/worklivoo-chat.css`, a partir do padrão "Conversa" da seção 5:

- **Lista** (`.wl-clist`): painel `--paper` de 22px, busca e filtros brancos; linha de 14px sem avatar com
  número 13px/700, hora à direita, prévia de uma linha. Linha selecionada = branca com sombra de vidro.
- **Conversa** (`.wl-thread`): cabeçalho branco com avatar de 32px, número, pílula de origem e selo
  "IA ativa" (preto) ou "IA pausada" (cinza). Ferramentas em ícones; o de ligar/desligar a IA fica
  `--danger` quando desligada.
- **Balões fiéis ao WhatsApp** (vale também para a página do lead): fundo `#efeae2` com padrão, enviado
  `#d9fdd3` à direita, recebido branco à esquerda, raio 14px, hora de 10px ao fim.
- **Follow-ups na conversa:** etiqueta preta com ícone e nome ("FollowUp Dinâmico" / "Extendido") e anel
  neutro; na lista, ícone cinza (avião = dinâmico, foguete = extendido). Sem âmbar nem índigo.
- Reações (gostei/não gostei) numa pílula branca sob a mensagem; "não gostei" marcado vira `--danger`.
- "Nova com IA" é o limão da tela; "Enviar" e "Nova manual" são pretos em vidro.

### Indique e Ganhe

Criado em `src/styles/worklivoo-referral.css`:

- Cartão da página; título 800 com a chamada ("Conhece alguma empresa…") e a oferta na legenda.
- **Recompensas:** dois painéis `--paper` (22px) com tile preto de ícone, valor 22px/800 e legenda.
- **Link:** painel `--paper` com campo somente leitura e botão **limão "Copiar"**, que vira preto
  "Copiado" por 2 segundos (sem verde).
- **Como funciona:** lista numerada com círculo preto e número branco. **Regulamento:** lista decimal
  de 62 caracteres de largura máxima e nota legal separada por fio.

### Configurações (casca)

Criado em `src/styles/worklivoo-settings.css`:

- Cartão da página com etiqueta, título e legenda; abaixo, barra de abas fixa no topo (`.wl-tabs--scroll`,
  rola de lado sem barra) usando o controle segmentado das abas do lead.
- Abas de recursos em destaque (FollowUp) ganham um ponto preto, sem gradiente âmbar.
- Cada aba é um arquivo em `src/pages/settings/` e é migrada para o padrão uma a uma.
- **Tokens:** `--muted` virou `--wl-muted` para não colidir com o shadcn; assim telas antigas e migradas
  convivem dentro de `.wl-scope`.

### Abas FollowUp (Dinâmico e Extendido)

- **Pastas:** `settings/followup-comum/` (tudo que é igual: hook de pagamento PIX, diálogo de contratação em 3 passos,
  tela de contratação, histórico e resumo do plano), `settings/followup-dinamico/` e `settings/followup-extendido/`
  (só a configuração de cada um e a tela "ativa"). O que varia entre os dois fica em `followup-comum/kinds.ts`
  (textos, colunas do banco, planos).
- **Cartões de configuração** (`.wl-set-card`): painel `--paper` de 22px, ícone em tile branco, caixas internas
  brancas (`.wl-set-box`), métricas em `.wl-set-tile`; barra de progresso em `--ink`. Cartão largo = `.wl-set-card--wide`.
- **Etapas do funil** (Extendido): caixas de seleção em tiles (`.wl-opt`), travadas até clicar em Editar.
- **Tela de contratação:** selos, botão limão; "Como funciona" em 4 etapas — as duas primeiras em `--paper`, as duas
  últimas em `--ink`. Sem partícula animada nem gradientes.
- **Diálogo:** planos selecionáveis (aro preto de 2px), resumo do rateio e pagamento PIX com QR em tile branco.
- **Tabela** (`.wl-tbl`): cabeçalho caixa alta 10,5px/800, linhas com `--line-soft`, linha clicável em `--stone`.

### Aba Gerais

- **Pastas:** `settings/GeraisTab.tsx` (só monta o layout e os diálogos) e `settings/gerais/` (hook `useGerais`, um
  arquivo por cartão e por diálogo, helpers de telefone e saudação). `GeraisCard` é o cartão padrão (ícone, título,
  descrição, botão Editar em vidro branco).
- **Layout:** `.wl-gerais` — cartão da Conta em coluna estreita à esquerda, pilha de cartões à direita; vira uma
  coluna abaixo de 1000px. Dentro do cartão: caixas brancas `.wl-set-box`, rótulos `.wl-label`, valores `.wl-kv`,
  números e etapas como `.wl-tag--plain`.
- **Ligado/desligado:** `StatusTag` (Ativado em `--won`, Desativado neutro) + `Switch` com `bg-[var(--ink)]` quando
  ligado — o limão fica só no botão primário.
- **Diálogos:** `GeraisDialog` (`wl-modal` sm/md/xl, `wl-scope`, sem foco automático). Escolha entre duas opções =
  `SegmentedChoice` (`.wl-tabs` com `role=radio`); lista de telefones = `PhoneListEditor` (+55, máscara, remover,
  adicionar); modelos de saudação e etapas = cartões selecionáveis `.wl-plan.wl-plan--text`.

### Aba Membros

- **Pastas:** `settings/MembrosTab.tsx` (cabeçalho, lista e diálogos) e `settings/membros/` (hook `useMembros`,
  `MembroCard`, diálogos de adicionar, editar e confirmar, helpers de telefone).
- **Cartão do membro** (`.wl-member`): painel `--paper` de 22px com avatar de iniciais (`.wl-avatar--lg`, branco),
  nome, e-mail, telefone formatado e etiqueta do cargo; desativado = opacidade reduzida + etiqueta `--idle`. Grade
  `.wl-members` com colunas de no mínimo 320px.
- **Menu de ações:** `.wl-iconbtn` com três pontos abrindo `.wl-menu` (itens com ícone de 15px); "Excluir" em
  `--danger` (`.wl-menu__item--danger`). O menu fecha ao escolher uma ação.
- **Confirmação** (excluir/desativar): `AlertDialog` com `wl-modal--sm`, botões simples `.wl-btn` (não usar
  `AlertDialogCancel`/`Action` direto, eles trazem as classes do shadcn e brigam com `.wl-btn`); excluir usa
  `.wl-btn--danger`, aviso em `.wl-confirm__warn`.
- **Formulários em diálogo:** `<form id>` no corpo e o botão de envio no rodapé com `form="id"`.

### Peças globais (banner, notificações, comunicado, acesso)

- **Arquivo:** `styles/worklivoo-shell.css`. Banner de pagamento em atraso = `.wl-banner` (painel `--paper`, ícone em
  tile `--danger`, título em `--danger`, botão limão); no celular empilha e o botão ocupa a largura toda.
- **Painel de notificações** (`NotificationPanel`): `.wl-notif` branco de 32px, abre pela esquerda sobre o menu; itens
  em `--paper` com ícone em tile branco, título (2 linhas), lead e etiqueta `.wl-tag--alert` com o atraso. Estados
  vazio e carregando em `.wl-notif__empty`.
- **Comunicado** (`ComunicadoModal`): `Dialog` (Radix) com `wl-modal wl-comunicado`, imagem quadrada, caixa
  `.wl-checkbox` e botões Fechar (`glass-ink`) e Continuar (limão).
- **Redefinir senha e 404:** mesmos blocos do login (`.wl-auth`, `.wl-card`, `.wl-control`). Qualquer endereço
  desconhecido cai em `NotFound` (`ClientPage` agora só renderiza ela).
- **Diálogos globais** (`Layout.tsx`): Pesquisa de Satisfação (obrigatória, sem fechar) e PIX do lembrete usam
  `.wl-overlay` + `.wl-modal`; a nota de 0 a 10 é `.wl-nps` (11 botões `.wl-nps__dot`, selecionado em `--ink`).
  Demonstração só em DEV: `?demo=atraso,tarefas,comunicado,nps,pix,pixqr`.

### Aba Assinatura

- **Pastas:** `settings/AssinaturaTab.tsx` escolhe a tela e `settings/assinatura/` guarda o hook `useAssinatura`
  (toda a cobrança via Asaas, movida sem reescrever), `types.ts` e as telas: `EscolherPagamento`, `PixPagamento`,
  `ConfigurarAssinatura` (faturamento + cartão), `AssinaturaAtiva` e `AnteciparDialogs`.
- **Fluxo de adesão:** cartão central `.wl-sub-card` (ícone em tile branco, título, cupom em `.wl-set-box`, opção PIX
  como botão com aro `--ink` no hover); passos em `.wl-steps`; formulário de faturamento em `.wl-bill` (3 colunas,
  2 no tablet, 1 no celular); confirmação do cartão em diálogo `wl-modal`.
- **Assinatura ativa:** `.wl-assin` (coluna estreita com cartão de pagamento e faturas + coluna larga com plano, valor
  mensal e uso do plano). Cartão visual `.wl-pcard` em `--ink` (cartão) ou `--stone` (PIX), sem blur nem sombra
  colorida. Faturas em `.wl-inv` com `.wl-tag` de estado (Pago `--won`, Atrasado `--alert`, Estornado `--idle`,
  Pendente neutro). Barra de uso em `--ink`, `--danger` quando passa do limite; "Antecipar fatura" = `.wl-btn--danger`.
- **Diálogos de antecipar fatura** (confirmação e PIX) usam o mesmo `GeraisDialog` (Radix), não mais overlay próprio;
  não fecham enquanto a antecipação está processando.

### Aba Histórico de Otimizações

- **Arquivo:** `settings/HistoricoOtimizacoesTab.tsx` (carrega os feedbacks negativos do usuário).
- **Tabela** (`.wl-tbl`, classe `.wl-hist`): data sem quebra, feedback em `.is-wrap`/700, status como `.wl-tag` —
  "Otimização concluída" em `--won` (ink) e "Em andamento" em `--idle`. Contador de registros em `.wl-tag--plain`.
- **Mobile (≤640px):** a tabela vira lista de cartões — data e status na primeira linha, texto do feedback abaixo —
  em vez de rolar para o lado.

### Aba Estoque de Produtos

- **Pastas:** `settings/EstoqueTab.tsx` e `settings/estoque/` (hook `useEstoque`, `helpers.ts`, `campos.ts` com os
  campos dos formulários por tipo, `colunas.tsx` com as colunas da tabela por tipo, `EstoqueTabela`, `ProdutoFormDialog`
  único para adicionar e editar).
- **Tabela** (`.wl-tbl` dentro de `.wl-tbl-wrap`, classe `.wl-estoque`): células de texto truncadas em 220px, link
  "Abrir" em `.wl-textlink`, seleção com `.wl-checkbox` (accent `--ink`), edição por linha com `.wl-iconbtn`. A roda do
  mouse rola a tabela para o lado.
- **Colunas vazias somem:** uma coluna sem nenhuma informação em todo o estoque (ex.: Portas) não aparece; basta uma
  linha com valor para ela surgir (`colunasComDados`). "-" e vazio contam como sem informação.
- **Barra:** busca em `.wl-input` + Adicionar (vidro) e Excluir (`.wl-btn--danger`) só quando a fonte é INTERNO;
  sincronizar (fonte externa) em vidro, com estado "Sincronizando" em `.wl-empty`. Paginação `.wl-pager`.
- **Formulário:** `.wl-subgrid` de duas colunas, trio quartos/banheiros/vagas em `.wl-trio`, máscaras de moeda/milhar
  preservadas.

### Aba Base de Conhecimento

- **Pastas:** `settings/BaseConhecimentoTab.tsx` e `settings/conhecimento/` (hook, `PerguntaCard`, `PerguntaDialog`
  usado para adicionar e editar).
- **Cartão de pergunta** (`.wl-qa`): painel `--paper`, pergunta (700) e resposta em `.wl-kv`; à direita etiqueta
  Ativo/Inativo + `Switch` em `--ink` e ícones de editar/remover (`.wl-iconbtn`, remover com `--danger`). Pergunta
  inativa fica com o texto a 60%. No mobile as ações descem para uma linha abaixo do texto.
- **Cabeçalho:** contador em `.wl-tag--plain` ("23 perguntas") ao lado do botão Adicionar.

### Aba WhatsApp

- **Pastas:** `settings/WhatsAppTab.tsx` escolhe a tela pela conta; `settings/whatsapp/` guarda os dois hooks
  (`useWhatsAppConexao` para QR Code/código, `useApiOficial` para criação e perfil), as telas e os diálogos.
- **Conexão (QR Code/código):** `.wl-wa` em duas colunas — "Como conectar" (passos com número em círculo `--ink`) e o
  painel de conexão com `SegmentedChoice` (QR Code | Código). O QR fica num tile branco; o código de pareamento em
  `.wl-wa__code`; o tempo de validade é `.wl-tag--won` (sem laranja). Desconectar = `.wl-btn--danger`.
- **API Oficial:** ativação em cartão centralizado (`.wl-wa-state`: ícone em tile branco, título, texto, botão limão);
  perfil em `.wl-subgrid` de caixas brancas, com o formulário de edição dentro de uma única `.wl-set-box`.
- **Seleção de DDD** (`.wl-ddd`) e **busca de cidade** (`.wl-citylist`) seguem o padrão de seleção por aro `--ink`
  de 2px. O verde da marca do WhatsApp NÃO é usado: o ícone entra em tile branco/preto como o resto do painel.

---

## 6. Imagem

**Fotografia é monocromática neutra.** Qualquer foto que entre no layout passa
por dessaturação. Cor solta briga com o limão.

**Retrato para avatar**: recorte medido, não fixo. Ache o topo da cabeça e corte
logo acima, com o mesmo respiro em todos — fotos diferentes têm enquadramentos
diferentes, e um recorte fixo afunda um rosto e corta outro.

**Logotipo de cliente entra em preto.** Converta usando a distância de cada pixel
até a cor de fundo, não o brilho — assim funciona igual para marca clara sobre
fundo escuro e escura sobre claro.

Duas armadilhas:

- **Formas sobrepostas viram mancha em silhueta.** Se o logotipo tem um símbolo
  colorido sobre outro, mapeie cada cor original para um tom de cinza diferente,
  preservando as relações de claro e escuro. Preto chapado apaga a estrutura.
- **Marca clara dentro de forma sólida** (letra branca dentro de círculo) precisa
  do tratamento invertido, senão a silhueta pega a forma e deixa a letra como
  buraco.

**Dê altura por logotipo, não a mesma para todos.** Um wordmark largo e um
emblema quadrado na mesma altura têm pesos visuais muito diferentes. Calcule a
altura para que todos ocupem largura parecida.

---

## 7. Armadilhas de CSS que já nos custaram tempo

- **`object-position` não faz nada** quando a imagem e a caixa têm a mesma
  proporção — sem corte, não há o que deslocar. Enquadramento nesse caso vem do
  arquivo.
- **`z-index` positivo num fundo pula por cima de camadas sem `z-index`**, mesmo
  que elas venham depois no HTML. Um fundo com `z-index:1` passa na frente do véu
  que deveria cobri-lo.
- **`img{ max-width:100% }` num reset grampeia imagem de fundo** que precisa ser
  maior que a caixa. Use `max-width:none` onde a sobra é intencional.
- **`display:flex` sem `align-items` estica o filho** — botão de largura
  automática vira largura total. Declare `align-items:flex-start`.
- **Elemento entre duas seções mata `.section + .section`**, e o divisor some sem
  aviso.

---

## 8. Como usar este arquivo

Coloque `CLAUDE.md` e `tokens.css` na raiz do projeto. O Claude Code lê o
`CLAUDE.md` sozinho a cada sessão e passa a seguir estas diretrizes.

Ao criar tela nova, o caminho é:

1. Importar `tokens.css`
2. Escolher o componente da seção 3 que mais se aproxima
3. Só inventar quando nenhum servir — e nesse caso, escrever aqui o que foi
   criado, para o próximo aproveitar

Este arquivo é vivo. Padrão que vingar entra aqui; padrão que se provar ruim sai.
