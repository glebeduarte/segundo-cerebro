import type { SupabaseClient } from "@supabase/supabase-js";
import { agendaEntre } from "@/lib/agenda";

const TZ = "America/Fortaleza";
const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Ferramentas que o Claude pode chamar para achar o que precisa responder. */
export const FERRAMENTAS = [
  { name: "agenda", description: "Compromissos do Google Agenda entre hoje e os próximos N dias (ou passados, com dias negativos). Use para próxima reunião, horários e o que vem pela frente.",
    input_schema: { type: "object", properties: { dias: { type: "integer", description: "Quantos dias à frente (padrão 14). Negativo para olhar para trás." }, busca: { type: "string", description: "Filtra pelo título do compromisso" } } } },
  { name: "buscar", description: "Busca no segundo cérebro (projetos, tarefas, reuniões do Granola com resumo completo, conversas, ideias, livros) por palavras. Devolve id, tipo, título, data e um trecho.",
    input_schema: { type: "object", properties: { texto: { type: "string" }, tipo: { type: "string", enum: ["projeto", "tarefa", "reuniao", "conversa", "ideia", "livro", "nota"] } }, required: ["texto"] } },
  { name: "abrir", description: "Lê um item completo pelo id: conteúdo inteiro (ex.: resumo completo da reunião), link, prazo, e os itens ligados a ele (tarefas, reuniões, conversas).",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
] as const;

export async function executar(sb: SupabaseClient, nome: string, args: Record<string, unknown>): Promise<string> {
  if (nome === "agenda") {
    const dias = Number(args.dias ?? 14), agora = new Date();
    const [a, b] = dias >= 0 ? [agora, new Date(+agora + dias * 86400000)] : [new Date(+agora + dias * 86400000), agora];
    let lista = await agendaEntre(a, b).catch(() => null);
    if (!lista) return "Agenda não conectada ou indisponível.";
    if (args.busca) { const t = String(args.busca).toLowerCase(); lista = lista.filter((c) => c.titulo.toLowerCase().includes(t)); }
    return lista.length ? lista.slice(0, 40).map((c) => `${c.diaInteiro ? "dia inteiro " + c.inicio.toLocaleDateString("pt-BR", { timeZone: TZ }) : fmt(c.inicio)} · ${c.titulo}${c.local ? " · " + c.local : ""}`).join("\n") : "Nenhum compromisso no período.";
  }
  if (nome === "buscar") {
    const palavras = String(args.texto ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
    let q = sb.from("itens").select("id,tipo,titulo,resumo,conteudo,status,ultimo_movimento").neq("status", "arquivado").order("ultimo_movimento", { ascending: false }).limit(12);
    if (args.tipo) q = q.eq("tipo", String(args.tipo));
    if (palavras.length) q = q.or(palavras.flatMap((w) => [`titulo.ilike.%${w}%`, `resumo.ilike.%${w}%`, `conteudo.ilike.%${w}%`]).join(","));
    const { data } = await q;
    if (!data?.length) return "Nada encontrado.";
    return data.map((i) => `[${i.id}] ${i.tipo} · ${i.titulo} · ${new Date(i.ultimo_movimento).toLocaleDateString("pt-BR", { timeZone: TZ })}${i.status === "concluido" ? " · concluído" : ""} · ${(i.resumo ?? i.conteudo ?? "").slice(0, 160)}`).join("\n");
  }
  if (nome === "abrir") {
    const { data: i } = await sb.from("itens").select("*, categorias(nome)").eq("id", String(args.id)).single();
    if (!i) return "Item não encontrado.";
    const { data: filhos } = await sb.from("itens").select("tipo,titulo,status,prazo,resumo,ultimo_movimento").eq("pai_id", i.id).neq("status", "arquivado").order("ultimo_movimento", { ascending: false }).limit(20);
    return [`${i.tipo}: ${i.titulo}`, i.categorias?.nome && `Área: ${i.categorias.nome}`, i.prazo && `Prazo: ${i.prazo}`, i.link && `Link: ${i.link}`, `Último movimento: ${new Date(i.ultimo_movimento).toLocaleDateString("pt-BR", { timeZone: TZ })}`,
      i.resumo && `Resumo: ${i.resumo}`, i.conteudo && `Conteúdo:\n${String(i.conteudo).slice(0, 6000)}`,
      filhos?.length ? "Ligados:\n" + filhos.map((f) => `- ${f.tipo} · ${f.titulo}${f.status === "concluido" ? " (concluído)" : ""}${f.prazo ? ` · prazo ${f.prazo}` : ""}${f.resumo ? " · " + f.resumo : ""}`).join("\n") : null,
    ].filter(Boolean).join("\n");
  }
  return "Ferramenta desconhecida.";
}
