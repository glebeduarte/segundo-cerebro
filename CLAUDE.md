# Segundo cérebro: contexto do projeto

Leia este arquivo antes de mexer no projeto. Ele descreve o que o app é, como está montado, o que já existe e as decisões tomadas até aqui.

## O que é

Painel pessoal de **Glebe Duarte**, mentor de negócios em Natal/RN ("Arquiteto de Negócios"), baseado no método CODE (Capturar, Organizar, Destilar, Expressar) com organização P.A.R.A.

O app reúne num só lugar projetos, tarefas, agenda, reuniões, notas, ideias e uso de apps; mostra o que foi começado e está parado; responde por voz perguntas sobre o contexto dele; e funciona como hub: cada item abre o lugar onde é resolvido (Google Agenda, nota do Granola, site, repositório) ou é resolvido dentro do próprio app.

- **No ar:** https://segundo-cerebro-black.vercel.app
- **Repositório:** github.com/glebeduarte/segundo-cerebro (branch `main`, a Vercel publica a cada push)
- **Usuário único:** glebejr@gmail.com, login por link mágico
- **Plano completo das fases:** `docs/PRD.md`

## Como Glebe quer trabalhar

- Tudo em **português do Brasil**: textos da interface, mensagens de commit, respostas.
- Tom direto e adulto. **Sem travessões (—)**, sem "não é X, é Y", sem metáforas ornamentais, sem frases de efeito, sem hipérbole.
- Ele aprova direções visuais e funcionais e espera que o trabalho siga até o fim, com deploy, sem pedir confirmação a cada passo.
- Usa muito no **iPhone** (Chrome/Safari) e no computador. Toda tela precisa funcionar nos dois.
- Não usar ElevenLabs (custo). Voz é do próprio navegador.

## Stack

- **Next.js 15** (App Router, TypeScript, sem Tailwind; CSS em `app/globals.css`)
- **Supabase**: Postgres, Auth, RLS. Projeto `jdeclczpctbqkilyunnb` (região São Paulo), organização separada dos outros projetos de Glebe
- **Vercel**: projeto `segundo-cerebro`, `vercel.json` fixa o framework Next.js
- **Claude API** (Haiku 5.5 por padrão) para perguntas e registros
- **Three.js r128** (CDN) no núcleo animado; **d3-force** no Mapa; **react-markdown + remark-gfm** nas notas; **node-ical** na agenda

### Variáveis de ambiente (Vercel)

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | https://jdeclczpctbqkilyunnb.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública (publishable) do Supabase |
| `ANTHROPIC_API_KEY` | chamadas ao Claude em `/api/perguntar` |
| `ANTHROPIC_MODEL` | opcional; padrão `claude-haiku-5-5` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth do Google para criar eventos (escopo calendar.events); redirect `/api/google/callback` |
| `GOOGLE_ICS_URL` | endereço secreto iCal do Google Agenda (dá acesso total à agenda: nunca expor) |

## Lições que já custaram tempo

- **Sem middleware.** O middleware com `@supabase/ssr` quebrou no Edge da Vercel (500 MIDDLEWARE_INVOCATION_FAILED). A checagem de login é feita em cada página com `sb.auth.getUser()` e `redirect("/login")`.
- **Nunca criar dados por GET.** Um link `/notas/nova` foi pré-carregado pelo Next e criou 11 notas vazias. Toda criação é por server action (POST). Links para páginas internas que fazem consultas pesadas usam `prefetch={false}`.
- **Fuso horário.** O servidor roda em UTC. Datas e horas de exibição usam `America/Fortaleza` (UTC-3, sem horário de verão). Ver `lib/agenda.ts` e a saudação em `app/page.tsx`.
- **Exclusões no banco** pelo conector do Supabase pedem confirmação que costuma ser cancelada. Prefira `status = 'arquivado'` a `delete`.
- **Criar projeto Supabase e tarefa agendada** pelos conectores foi bloqueado por permissão. Glebe faz essas etapas manualmente quando necessário.

## Estrutura do código

```
app/
  page.tsx            Tela Hoje: núcleo 3D, saudação, campo de pergunta/voz, painel (caixa de entrada, tarefas do dia, agenda, reuniões, dias parados, ideias)
  actions.ts          Server actions: capturar, classificar, concluir, arquivar, reabrir, salvarItem, novaTarefa, criarTarefa
  api/perguntar/      Claude com ferramentas (agenda, buscar, abrir, registrar); resposta curta lida em voz alta
  api/uso/            Recebe uso de apps por token (Atalhos do iPhone, ActivityWatch)
  item/[id]/          Página de qualquer item: botão "Abrir onde isso é feito", link/prazo/notas, tarefas, conectados, histórico
  tarefas/            Lista agrupada (atrasadas, hoje, 7 dias, depois, sem prazo), criação rápida com link opcional
  notas/              Módulo estilo Obsidian: árvore por área, editor markdown, [[links]], #tags, subnotas, "Mencionada em"
  mapa/               Grafo de conexões com zoom, arrastar, pinça e caixa de detalhes
  vida/               Movimento por área nos últimos 30 dias
  foco/               Uso de computador (horas) e iPhone (aberturas) nos últimos 7 dias, com instruções de configuração
  login/, auth/callback/
components/           Editor.tsx (notas), Grafo.tsx (mapa), MenuMovel.tsx (barra inferior no celular)
lib/
  supabase/           Clientes server e browser
  agenda.ts           Lê o iCal (eventos únicos, recorrentes, dia inteiro) e gera link de cada evento no Google Agenda
  contexto.ts         Ferramentas do Claude: agenda, buscar, abrir
  destino.ts          Para onde um item leva: link próprio > origem > link do projeto pai > página interna
  nucleo.ts           Liga item novo ao contexto: projeto ao núcleo da sua área, citados como "relacionado"
  classes.ts          Classificação de apps em trabalho, comunicação, lazer, redes sociais, outros
  dados.ts            Carga comum do Mapa e da Vida
public/nucleo.js      Núcleo 3D (rosto de pixels, olha para o mouse, pisca, fala), circuitos animados, sons, voz
scripts/activitywatch-sync.py   Envia uso do computador por hora ao /api/uso
supabase/migrations/  Histórico do esquema (aplicado manualmente no projeto)
```

## Banco de dados

Usuário dono: `1506574b-7695-4919-b0f4-252ebf11a83f`. Todas as tabelas têm RLS `user_id = (select auth.uid())`.

**`itens`** é a tabela central. Tudo é um item, diferenciado por `tipo`:
- `tipo`: projeto, area (núcleo), tarefa, ideia, nota, livro, reuniao, conversa, recurso
- `status`: ideia, ativo, pausado, parado, concluido, arquivado (o app nunca apaga, arquiva)
- `pai_id`: hierarquia (tarefa dentro de projeto, subnota dentro de nota)
- `categoria_id`: área da vida
- `link`: onde o item é resolvido
- `origem` / `origem_ref`: de onde veio (granola, chat_claude, voz, captura, manual, nota) e URL de origem. Índice único em `(user_id, origem_ref)` impede importar duas vezes
- `ultimo_movimento`: base do cálculo de "parado" (projeto ativo há mais de 14 dias sem movimento)
- `conteudo` (texto completo, markdown nas notas), `resumo`, `tags[]`, `prazo`, `atualizado_em`

Outras tabelas: `categorias` (Clientes, Produtos próprios, Expoeduc, Família, Lazer e RPG, Casa), `conexoes` (de_id, para_id, relacao: parte_de, menciona, relacionado), `pessoas`, `item_pessoas`, `eventos`, `uso_apps`, `tokens_uso`, `briefings`.

Função `registrar_uso(token, registros)` (security definer) é a única porta de escrita sem login.

### Núcleo "Meu negócio"

Item `tipo='area'` com `tags = ['clientes','produtos próprios','expoeduc']`. Todo projeto dessas áreas se liga a ele (`conexoes.relacao = 'parte_de'`) via `lib/nucleo.ts`, ao ser criado pela voz ou classificado na caixa de entrada. Para criar outro núcleo (ex.: Família), basta um item `tipo='area'` com as áreas em `tags`.

## Projetos e contexto de Glebe registrados no banco

- **Clientes:** Consultoria Jácome (principal; mentoria odontológica de Alexandre e Marianna, produto dos filhos Léo e Davi), Hangar Club (app de treinos, hangar-club.app), Leonardo Dantas, Método Mário Santana, Bartira Rebouças, Chalet Suisse
- **Produtos próprios:** Negócio de Conteúdo / Mind Club (com Letícia Souza), Quizuu, Extensão WhatsApp, Segundo cérebro
- **Expoeduc:** Expoeduc Academy (plataforma para gestores escolares; treinamento de IA da equipe em 29/10)
- **Lazer e RPG:** Spellfire, Sistema APRPG
- **Família:** RPG com os filhos e jogo de investigação (Rafael e Lara, no Canadá)
- **Casa:** Aluguel da casa (reajuste vence 15/11), Casa Hylana
- Reuniões do Granola de outubro/2026 importadas com resumo completo em `conteudo`

## Integrações

- **Google Agenda:** leitura por iCal secreto (`GOOGLE_ICS_URL`), cache de 5 minutos. Cada evento abre no Google Agenda. Escrita por OAuth (`lib/google.ts`, tabela `google_tokens` com o refresh token): formulário "Novo evento" no painel Agenda e ferramenta `criar_evento` do Claude na voz. O feed iCal do Google pode levar alguns minutos para mostrar o evento novo.
- **Granola** (plano gratuito: resumos sim, transcrições não, histórico de 30 dias): importação feita por Claude via conector, não pelo app. Reuniões entram como `tipo='reuniao'`, próximos passos como tarefas; responsável incerto vira "Responsável a confirmar".
- **Conversas no claude.ai:** o app não lê o histórico. Registro via skill "registrar-segundo-cerebro" (grava no banco quando Glebe diz "registra isso no segundo cérebro").
- **iPhone:** automação do app Atalhos por app aberto, POST em `/api/uso` com `Authorization: Bearer <token>`. Só aberturas (o iOS não libera duração).
- **Computador:** ActivityWatch + `scripts/activitywatch-sync.py` a cada hora.

## Design

- Paleta: fundo `#f1f1ef`, superfícies `#f5f5f3`/branco, texto `#1f201d`, acento verde-petróleo `#13897e` / `#1b6e66`, alerta âmbar `#92400e` / `#b5560f`. Sem gradientes, sem sombras em repouso, sem emoji.
- Tipografia: Instrument Sans (uma família).
- Tela Hoje: núcleo 3D com rosto de pixels no centro, áreas em arco à direita ligadas por linhas, circuitos animados no fundo, sons curtos sintetizados (botão de mudo no topo), resposta do Claude lida em voz.
- Celular: menu no topo com rolagem lateral e barra inferior fixa (Hoje, Tarefas, Notas, Mapa, Vida).
- Respeita `prefers-reduced-motion`.

## Estado das fases (docs/PRD.md)

1. Base: feito
2. Projetos, caixa de entrada: feito
3. Agenda: feito
4. Granola e conversas: importação manual pelo Claude e skill de registro; tarefa agendada diária bloqueada por permissão
5. Voz com Claude e ferramentas: feito
6. Mapa e Vida: feito (com zoom, detalhes e núcleo)
7. Foco: feito no app; falta Glebe configurar Atalhos e ActivityWatch
8. **Pendente:** busca por significado (pgvector já instalado, coluna `embedding vector(1024)`), resumo diário de manhã (`briefings`), revisão semanal de domingo

Extras pedidos e feitos: tarefas com link externo ou resolução no app, notas estilo Obsidian, hub (cada item abre onde é resolvido), saudação por horário.

## Pendências conhecidas

- Links de destino faltando na maioria dos projetos (só Hangar Club, Quizuu, Segundo cérebro, Expoeduc Academy e Negócio de Conteúdo têm)
- Busca por palavras não ignora acentos ("Jacome" não acha "Jácome"); resolver na fase 8
- Desligar cadastro aberto no Supabase (Authentication > Sign In / Providers)
- 11 notas vazias arquivadas (não apagadas) do incidente do pré-carregamento

## Como trabalhar no projeto

```bash
npm install
npm run build     # sempre rodar antes de commitar; o lint do Next falha o build
```

Mudanças de banco: aplicar no Supabase e salvar o SQL em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`. Commits em português, terminando com as linhas de coautoria do Claude.
