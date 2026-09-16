# CLAUDE.md

Instruções para o Claude Code neste repositório (PAINEL WORKLIVOO V2).

## Supabase — projeto autorizado

O único projeto Supabase autorizado para este repositório é:

- **Project ref:** `lnhsqcekgidbbvdiwzzl`
- **URL:** `https://lnhsqcekgidbbvdiwzzl.supabase.co`

**NUNCA** execute leituras, escritas, migrações ou qualquer operação via MCP do Supabase (ou SDK/API) em outro projeto que não seja este. Se o MCP estiver conectado a um projeto diferente, ou se houver ambiguidade sobre qual projeto usar, pare e confirme com o usuário antes de prosseguir. Não assuma outros projetos Supabase da conta como válidos para este repositório, mesmo que estejam acessíveis.

## Tabelas — apenas `_v2`

Este projeto está em migração de esquema. A partir de agora, **somente as tabelas cujo nome termina com o sufixo `_v2`** devem ser lidas, escritas ou alteradas. As tabelas antigas (sem `_v2`) são legadas e **NÃO devem ser tocadas** — nem para leitura exploratória, nem para escrita, nem para alteração de schema — a menos que o usuário peça explicitamente e de forma inequívoca.

Tabelas `_v2` atualmente em uso (lista de referência — pode mudar; sempre confira com `list_tables` antes de operar):

- `leads_v2`
- `usuarios_v2`
- `membros_v2`
- `feedbacks_v2`
- `tickets_v2`
- `base_conhecimento_v2`
- `produto_carro_v2`
- `produto_imobiliaria_v2`
- `lista_prospeccao_v2`
- `followup_dinamico_v2`
- `comunicados_v2`
- `comunicado_historico_v2`
- `leads_notas_v2`
- `lead_tarefas_v2`

Tabelas legadas (proibido mexer sem autorização explícita do usuário): `leads`, `usuarios`, `membros`, `feedbacks`, `tickets`, `leads_historico`, `leads_treinamento`, `console`, `proprietarios`, `historico_mensagens`, `acionamentos_whatsapp`, `lista_prospeccao`, `central_listas`, `conhecimento_pastas`, `conhecimento_subpastas`, `conhecimento_artigos`, `lojas_webmotors`, `scraper_estado`, `teste_murilo_lista_industrias_squalo_worklivoo`.

Antes de qualquer query ou migração, verifique se as tabelas envolvidas terminam em `_v2`. Se uma tarefa exigir tocar em uma tabela legada, avise o usuário explicitamente e peça confirmação antes de agir.
