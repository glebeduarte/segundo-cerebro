import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { agendaDeHoje } from "@/lib/agenda";

export const runtime = "nodejs";
const MODELO = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const TZ = "America/Fortaleza";

type Saida = {
  intencao: "pergunta" | "registro";
  resposta: string;
  registro?: { tipo: string; titulo: string; categoria?: string | null; projeto?: string | null; prazo?: string | null };
};

export async function POST(req: Request) {
  const { texto } = await req.json().catch(() => ({ texto: "" }));
  const pedido = String(texto ?? "").trim().slice(0, 2000);
  if (!pedido) return NextResponse.json({ erro: "vazio" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ erro: "Chave da Anthropic não configurada." }, { status: 500 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const [{ data: itens }, { data: cats }] = await Promise.all([
    sb.from("itens").select("id,tipo,titulo,resumo,status,prazo,ultimo_movimento,categoria_id,pai_id").neq("status", "arquivado").neq("status", "concluido").limit(300),
    sb.from("categorias").select("id,nome"),
  ]);
  let agenda: { titulo: string; inicio: Date; diaInteiro: boolean }[] | null = null;
  try { agenda = await agendaDeHoje(); } catch {}

  const agora = new Date();
  const dias = (d: string) => Math.floor((+agora - +new Date(d)) / 86400000);
  const nomeCat = (id: string | null) => cats?.find((c) => c.id === id)?.nome ?? "sem área";
  const projetos = (itens ?? []).filter((i) => i.tipo === "projeto");
  const nomeProj = (id: string | null) => projetos.find((p) => p.id === id)?.titulo;
  const linhas = [
    `Agora: ${agora.toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" })}.`,
    `Áreas: ${(cats ?? []).map((c) => c.nome).join(", ")}.`,
    "Agenda de hoje:", ...(agenda?.length ? agenda.map((c) => `- ${c.diaInteiro ? "dia inteiro" : c.inicio.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })} ${c.titulo}`) : [agenda ? "- nada" : "- agenda não conectada"]),
    "Projetos (dias desde o último movimento):", ...projetos.map((p) => `- ${p.titulo} [${nomeCat(p.categoria_id)}] ${dias(p.ultimo_movimento)} dias${p.prazo ? `, prazo ${p.prazo}` : ""}`),
    "Tarefas abertas:", ...(itens ?? []).filter((i) => i.tipo === "tarefa").map((t) => `- ${t.titulo}${t.prazo ? ` (prazo ${t.prazo})` : ""}${nomeProj(t.pai_id) ? ` · ${nomeProj(t.pai_id)}` : ""}${t.resumo ? ` · ${t.resumo}` : ""}`),
    "Ideias e livros:", ...(itens ?? []).filter((i) => ["ideia", "livro"].includes(i.tipo)).map((i) => `- ${i.tipo}: ${i.titulo}`),
  ].join("\n");

  const sistema = `Você é o segundo cérebro de Glebe Duarte, mentor de negócios em Natal. Responda sempre em português do Brasil, frases curtas, tom direto e adulto, sem travessões, sem emoji, sem listas com marcadores. A resposta será lida em voz alta: no máximo 3 frases e 60 palavras.
Decida a intenção da mensagem:
- "pergunta": ele quer saber algo (o que fazer hoje, o que está parado, agenda, prioridades). Responda só com base nos dados abaixo. Se o dado não existir, diga que não está registrado. Ao sugerir prioridades, considere prazos, compromissos do dia e projetos parados há mais de 14 dias.
- "registro": ele está contando uma tarefa, ideia, projeto, livro ou nota para guardar. Preencha "registro" com tipo (tarefa, ideia, projeto, livro ou nota), um título curto e claro, a área (nome exato da lista ou null), o projeto (título exato da lista ou null) e prazo em AAAA-MM-DD se ele citar data. A resposta confirma em uma frase o que foi guardado e onde.
Devolva apenas JSON válido no formato {"intencao":"pergunta"|"registro","resposta":"...","registro":{...}|null}.

DADOS ATUAIS
${linhas}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELO, max_tokens: 500, system: sistema, messages: [{ role: "user", content: pedido }] }),
  });
  if (!r.ok) {
    const detalhe = await r.text();
    console.error("anthropic", r.status, detalhe.slice(0, 300));
    return NextResponse.json({ erro: `A API do Claude respondeu ${r.status}.` }, { status: 502 });
  }
  const j = await r.json();
  let saida: Saida;
  try { const t = String(j.content?.[0]?.text ?? ""); saida = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); }
  catch { return NextResponse.json({ intencao: "pergunta", resposta: "Não consegui entender a resposta agora. Tente de novo." }); }

  if (saida.intencao === "registro" && saida.registro?.titulo) {
    const g = saida.registro;
    const tipo = ["tarefa", "ideia", "projeto", "livro", "nota"].includes(g.tipo) ? g.tipo : "nota";
    const categoria_id = cats?.find((c) => c.nome.toLowerCase() === String(g.categoria ?? "").toLowerCase())?.id ?? null;
    const pai = projetos.find((p) => p.titulo.toLowerCase() === String(g.projeto ?? "").toLowerCase());
    const prazo = /^\d{4}-\d{2}-\d{2}$/.test(String(g.prazo)) ? g.prazo : null;
    const { error } = await sb.from("itens").insert({
      tipo, titulo: g.titulo.slice(0, 140), conteudo: pedido, prazo,
      status: tipo === "tarefa" || tipo === "projeto" ? "ativo" : "ideia",
      categoria_id: categoria_id ?? pai?.categoria_id ?? null, pai_id: pai?.id ?? null, origem: "voz",
    });
    if (error) return NextResponse.json({ intencao: "registro", resposta: "Não consegui gravar agora. Tente de novo.", erro: error.message }, { status: 500 });
    if (pai) await sb.from("itens").update({ ultimo_movimento: agora.toISOString() }).eq("id", pai.id);
  }
  return NextResponse.json({ intencao: saida.intencao, resposta: saida.resposta });
}
