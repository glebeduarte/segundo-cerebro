# Segundo Cérebro: PRD

Repositório: `glebeduarte/segundo-cerebro`
Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Edge Functions, pgvector), Vercel, API do Claude.
Usuário: apenas Glebe (login único por e-mail).
Método base: CODE (Capturar, Organizar, Destilar, Expressar) com organização P.A.R.A.

## 1. Objetivo

Um painel visual, mobile first (iPhone), que reúne projetos, tarefas, ideias, leituras, agenda, reuniões e registros de uso, mostra o que foi começado e não terminado, como as coisas se conectam e em quais categorias da vida estão, e responde por voz a perguntas como "o que preciso fazer hoje?".

## 2. Fontes de dados

| Fonte | Como entra | Automático? |
|---|---|---|
| Conversas no Claude | Comando "registra no segundo cérebro" durante o chat, gravado via conector Supabase; tarefa agendada diária revisa chats recentes (a testar) | Parcial |
| Captura rápida | Caixa de entrada do painel, por texto ou ditado do iPhone | Manual |
| Agenda | Google Calendar (leitura via API) | Sim |
| Reuniões | Granola/Tactiq: resumo e decisões lançados como registro ligado ao projeto | Parcial |
| Uso do iPhone | Automação do app Atalhos: "ao abrir app X" envia POST para endpoint do painel | Sim, só aberturas |
| Uso do computador | ActivityWatch local, sincronização periódica por script | Sim |
| Livros, lazer, ideias | Cadastro manual ou por voz | Manual |

## 3. Telas

1. **Hoje**: agenda do dia, até 3 prioridades sugeridas, tarefas vencendo, itens parados há mais de 14 dias, botão de voz.
2. **Caixa de entrada**: tudo que foi capturado e ainda não classificado. O Claude sugere tipo, categoria e projeto; você confirma com um toque.
3. **Projetos**: quadro por status (ativo, pausado, parado, concluído, arquivado), com filtro por categoria da vida e indicador de último movimento.
4. **Mapa**: grafo de conexões entre projetos, pessoas, ideias e conversas.
5. **Vida**: visão por categorias (trabalho/clientes, produtos próprios, família, lazer/RPG, estudo/leitura, saúde, espiritualidade), com distribuição do tempo e da atenção.
6. **Foco**: gráficos de uso do iPhone e do computador por dia e por tipo (produtivo, relaxamento, distração).
7. **Linha do tempo**: tudo o que aconteceu, em ordem, com busca.

## 4. Voz

- Entrada: ditado nativo do iPhone no campo de texto, ou Web Speech API quando disponível.
- Processamento: Edge Function chama o Claude com o contexto do dia (agenda, tarefas, itens parados).
- Saída: `speechSynthesis` do navegador em pt-BR. Custo zero de síntese.

## 5. Inteligência

- **Classificação** de capturas (tipo, categoria, projeto, conexões).
- **Destilação**: resumo progressivo de notas e reuniões em pontos-chave.
- **Revisão diária** (tarefa agendada, 6h): gera o briefing do dia e marca projetos parados.
- **Revisão semanal** (domingo): o que avançou, o que parou, o que arquivar.
- **Busca semântica** com pgvector sobre notas, conversas e reuniões.

## 6. Fases

| Fase | Entrega | Complexidade |
|---|---|---|
| 1 | Repositório, projeto Supabase, esquema, auth, deploy vazio na Vercel | Baixa |
| 2 | Carga inicial dos projetos e áreas já conhecidos; telas Projetos e Caixa de entrada | Média |
| 3 | Tela Hoje + Google Calendar | Média |
| 4 | Registro a partir do chat do Claude (comando + tarefa agendada) | Média |
| 5 | Voz (pergunta e resposta) | Média |
| 6 | Mapa de conexões e tela Vida | Média |
| 7 | Foco: endpoint para Atalhos do iPhone + sincronização do ActivityWatch | Média |
| 8 | Reuniões (Granola/Tactiq), busca semântica, revisões diária e semanal | Alta |

## 7. Segurança e privacidade

- Row Level Security em todas as tabelas, restrito ao seu usuário.
- Chave da API do Claude só em Edge Functions, nunca no navegador.
- Endpoint dos Atalhos protegido por token próprio.
- Dados de reuniões guardam resumo e decisões; transcrição completa é opcional.

## 8. Custos estimados

- Supabase e Vercel: plano gratuito cobre o uso de uma pessoa no início.
- API do Claude: classificação e briefing diário, poucos dólares por mês com modelo menor (Haiku) nas tarefas de rotina.
