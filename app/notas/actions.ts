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
