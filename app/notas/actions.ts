"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const tagsDe = (t: string) => [...new Set([...t.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((m) => m[1].toLowerCase()))];
const linksDe = (t: string) => [...new Set([...t.matchAll(/\[\[([^\]|]{1,140})(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim()))];

export async function salvarNota(n: { id: string; titulo: string; conteudo: string; categoria_id: string | null; pai_id: string | null }) {
  const sb = await createClient();
  const agora = new Date().toISOString();
  const titulo = n.titulo.trim() || "Sem título";
  const { error } = await sb.from("itens").update({
    titulo, conteudo: n.conteudo, tags: tagsDe(n.conteudo), categoria_id: n.categoria_id || null,
    pai_id: n.pai_id && n.pai_id !== n.id ? n.pai_id : null, atualizado_em: agora, ultimo_movimento: agora,
  }).eq("id", n.id);
  if (error) return { ok: false, erro: error.message };

  // [[links]] viram conexões "menciona"
  const alvos = linksDe(n.conteudo);
  await sb.from("conexoes").delete().eq("de_id", n.id).eq("relacao", "menciona");
  if (alvos.length) {
    const { data: achados } = await sb.from("itens").select("id,titulo").in("titulo", alvos).neq("status", "arquivado");
    const linhas = (achados ?? []).filter((a) => a.id !== n.id).map((a) => ({ de_id: n.id, para_id: a.id, relacao: "menciona" }));
    if (linhas.length) await sb.from("conexoes").upsert(linhas, { onConflict: "de_id,para_id,relacao", ignoreDuplicates: true });
  }
  if (n.pai_id) await sb.from("itens").update({ ultimo_movimento: agora }).eq("id", n.pai_id).neq("tipo", "nota");
  revalidatePath("/notas", "layout");
  return { ok: true, salvoEm: agora };
}

/** Cria uma nota (vinda de um botão ou de um [[link]] novo) e abre. Só por POST, nunca por pré-carregamento de link. */
export async function criarNota(form: FormData) {
  const { redirect } = await import("next/navigation");
  const sb = await createClient();
  const titulo = String(form.get("titulo") ?? "").trim().slice(0, 140);
  const pai = String(form.get("pai") ?? "") || null;
  if (titulo) {
    const { data: existe } = await sb.from("itens").select("id,tipo").eq("titulo", titulo).neq("status", "arquivado").limit(1).maybeSingle();
    if (existe) redirect(existe.tipo === "nota" ? `/notas/${existe.id}` : `/item/${existe.id}`);
  }
  let categoria_id: string | null = null;
  if (pai) { const { data: p } = await sb.from("itens").select("categoria_id").eq("id", pai).single(); categoria_id = p?.categoria_id ?? null; }
  const t = titulo || "Nova nota";
  const { data } = await sb.from("itens").insert({ tipo: "nota", titulo: t, conteudo: titulo ? `# ${t}\n\n` : "", status: "ativo", pai_id: pai, categoria_id, origem: "nota" }).select("id").single();
  revalidatePath("/notas", "layout");
  redirect(data ? `/notas/${data.id}` : "/notas");
}
