import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FERRAMENTAS, executar } from "@/lib/contexto";
import { conectarNoContexto } from "@/lib/nucleo";

export const runtime = "nodejs";
export const maxDuration = 60;
const MODELO = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const TZ = "America/Fortaleza";

const REGISTRAR = {
  name: "registrar",
  description: "Guarda no segundo cérebro algo que Glebe pediu para anotar: tarefa, ideia, projeto, livro ou nota. Use só quando ele quiser registrar, não para perguntas.",
  input_schema: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["tarefa", "ideia", "projeto", "livro", "nota"] },
      titulo: { type: "string", description: "Título curto e claro" },
      area: { type: "string", description: "Nome exato de uma das áreas, ou vazio" },
      projeto: { type: "string", description: "Título exato de um projeto existente, ou vazio" },
      prazo: { type: "string", description: "AAAA-MM-DD se ele citou data" },
      relacionados: { type: "array", items: { type: "string" }, description: "Títulos exatos de projetos, pessoas ou notas existentes a que isto se liga" },
    },
    required: ["tipo", "titulo"],
  },
} as const;

type Bloco = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

export async function POST(req: Request) {
  const { texto } = await req.json().catch(() => ({ texto: "" }));
  const pedido = String(texto ?? "").trim().slice(0, 2000);
  if (!pedido) return NextResponse.json({ erro: "vazio" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ erro: "Chave da Anthropic não configurada." }, { status: 500 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const [{ data: itens }, { data: cats }] = await Promise.all([
    sb.from("itens").select("id,tipo,titulo,status,prazo,ultimo_movimento,categoria_id,pai_id").in("tipo", ["projeto", "tarefa"]).in("status", ["ativo", "pausado", "parado"]).limit(200),
    sb.from("categorias").select("id,nome"),
  ]);
  const agora = new Date();
  const projetos = (itens ?? []).filter((i) => i.tipo === "projeto");
  const dias = (d: string) => Math.floor((+agora - +new Date(d)) / 86400000);
  const base = [
    `Agora: ${agora.toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" })} (fuso de Natal).`,
    `Áreas: ${(cats ?? []).map((c) => c.nome).join(", ")}.`,
    "Projetos ativos (dias sem movimento): " + projetos.map((p) => `${p.titulo} (${dias(p.ultimo_movimento)})`).join("; "),
    "Tarefas abertas: " + (itens ?? []).filter((i) => i.tipo === "tarefa").map((t) => `${t.titulo}${t.prazo ? ` [prazo ${t.prazo}]` : ""}`).join("; "),
  ].join("\n");

  const sistema = `Você é o segundo cérebro de Glebe Duarte, mentor de negócios em Natal. Você conhece a agenda dele (Google Agenda), as reuniões gravadas no Granola com resumo completo, projetos, tarefas, ideias e conversas registradas.
Para responder, busque os dados com as ferramentas antes de afirmar qualquer coisa. Exemplos: "próxima reunião" → agenda; "o que levar para a reunião com X" → agenda para achar a próxima com X, depois buscar a última reunião com X e abrir o resumo completo, e responder com pendências e próximos passos que ficaram dela; "como está o projeto Y" → buscar e abrir.
Se ele quiser anotar algo, use registrar já entendendo o contexto: escolha a área e o projeto certos pela lista de projetos e pelo assunto (um cliente novo vai para a área Clientes; algo sobre um cliente existente vai dentro do projeto dele), e preencha relacionados com os títulos exatos de outros itens citados. Na dúvida sobre a qual projeto pertence, use buscar antes de registrar.
Se o dado não existir, diga que não está registrado e onde ele pode estar. Nunca invente nomes, datas ou números.
A resposta final será lida em voz alta: português do Brasil, tom direto, sem travessões, sem emoji, sem listas ou marcadores, no máximo 4 frases e 80 palavras.

RESUMO ATUAL
${base}`;

  const tools = [...FERRAMENTAS, REGISTRAR];
  const mensagens: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: pedido }];
  let registrou = false;

  for (let volta = 0; volta < 6; volta++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELO, max_tokens: 700, system: sistema, tools, messages: mensagens }),
    });
    if (!r.ok) {
      console.error("anthropic", r.status, (await r.text()).slice(0, 300));
      return NextResponse.json({ erro: `A API do Claude respondeu ${r.status}.` }, { status: 502 });
    }
    const j = await r.json();
    const blocos: Bloco[] = j.content ?? [];
    const usos = blocos.filter((b) => b.type === "tool_use");
    if (j.stop_reason !== "tool_use" || !usos.length) {
      const resposta = blocos.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim() || "Não encontrei uma resposta.";
      return NextResponse.json({ intencao: registrou ? "registro" : "pergunta", resposta });
    }
    mensagens.push({ role: "assistant", content: blocos });
    const resultados = [];
    for (const u of usos) {
      let saida: string;
      try {
        if (u.name === "registrar") { saida = await registrar(sb, u.input ?? {}, pedido, cats ?? [], projetos); registrou = true; }
        else saida = await executar(sb, u.name!, u.input ?? {});
      } catch (e) { saida = `Erro: ${(e as Error).message}`; }
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: saida.slice(0, 12000) });
    }
    mensagens.push({ role: "user", content: resultados });
  }
  return NextResponse.json({ intencao: registrou ? "registro" : "pergunta", resposta: "A busca ficou longa demais. Tente uma pergunta mais específica." });
}

async function registrar(
  sb: Awaited<ReturnType<typeof createClient>>, g: Record<string, unknown>, pedido: string,
  cats: { id: string; nome: string }[], projetos: { id: string; titulo: string; categoria_id: string | null }[],
) {
  const tipo = ["tarefa", "ideia", "projeto", "livro", "nota"].includes(String(g.tipo)) ? String(g.tipo) : "nota";
  const titulo = String(g.titulo ?? "").slice(0, 140);
  if (!titulo) return "Faltou o título.";
  const cat = cats.find((c) => c.nome.toLowerCase() === String(g.area ?? "").toLowerCase());
  const pai = projetos.find((p) => p.titulo.toLowerCase() === String(g.projeto ?? "").toLowerCase());
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(String(g.prazo ?? "")) ? String(g.prazo) : null;
  const { data: novo, error } = await sb.from("itens").insert({
    tipo, titulo, conteudo: pedido, prazo, origem: "voz",
    status: tipo === "tarefa" || tipo === "projeto" ? "ativo" : "ideia",
    categoria_id: cat?.id ?? pai?.categoria_id ?? null, pai_id: pai?.id ?? null,
  }).select("id").single();
  if (error || !novo) return `Falhou ao gravar: ${error?.message}`;
  await conectarNoContexto(sb, novo.id, Array.isArray(g.relacionados) ? (g.relacionados as string[]) : []);
  if (pai) await sb.from("itens").update({ ultimo_movimento: new Date().toISOString() }).eq("id", pai.id);
  return `Gravado: ${tipo} "${titulo}"${pai ? ` no projeto ${pai.titulo}` : cat ? ` na área ${cat.nome}` : " na caixa de entrada"}${prazo ? `, prazo ${prazo}` : ""}.`;
}
