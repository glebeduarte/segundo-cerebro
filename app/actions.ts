"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { criarEvento } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";
import { conectarNoContexto } from "@/lib/nucleo";

export async function capturar(form: FormData) {
  const texto = String(form.get("texto") ?? "").trim();
  if (!texto) return;
  const sb = await createClient();
  await sb.from("itens").insert({ tipo: "nota", titulo: texto.slice(0, 140), conteudo: texto, status: "ideia", origem: "captura" });
  revalidatePath("/");
}

export async function classificar(form: FormData) {
  const id = String(form.get("id")), tipo = String(form.get("tipo")), categoria_id = String(form.get("categoria") || "") || null;
  const status = tipo === "tarefa" || tipo === "projeto" ? "ativo" : "ideia";
  const sb = await createClient();
  await sb.from("itens").update({ tipo, categoria_id, status, ultimo_movimento: new Date().toISOString() }).eq("id", id);
  await conectarNoContexto(sb, id);
  revalidatePath("/");
}

export async function concluir(form: FormData) {
  const id = String(form.get("id"));
  const sb = await createClient();
  const { data } = await sb.from("itens").update({ status: "concluido", atualizado_em: new Date().toISOString() }).eq("id", id).select("pai_id").single();
  if (data?.pai_id) await sb.from("itens").update({ ultimo_movimento: new Date().toISOString() }).eq("id", data.pai_id);
  revalidatePath("/"); revalidatePath("/tarefas");
}

export async function arquivar(form: FormData) {
  const sb = await createClient();
  await sb.from("itens").update({ status: "arquivado" }).eq("id", String(form.get("id")));
  revalidatePath("/");
}

export async function salvarItem(form: FormData) {
  const id = String(form.get("id"));
  const link = String(form.get("link") ?? "").trim();
  const prazo = String(form.get("prazo") ?? "").trim();
  const resumo = String(form.get("resumo") ?? "").trim();
  const sb = await createClient();
  await sb.from("itens").update({
    link: link ? (/^https?:\/\//.test(link) ? link : `https://${link}`) : null,
    prazo: prazo || null, resumo: resumo || null, ultimo_movimento: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/"); revalidatePath(`/item/${id}`);
}

export async function novaTarefa(form: FormData) {
  const pai = String(form.get("pai")), titulo = String(form.get("titulo") ?? "").trim();
  if (!titulo) return;
  const sb = await createClient();
  const { data: p } = await sb.from("itens").select("categoria_id").eq("id", pai).single();
  await sb.from("itens").insert({ tipo: "tarefa", titulo, status: "ativo", pai_id: pai, categoria_id: p?.categoria_id ?? null, origem: "manual" });
  await sb.from("itens").update({ ultimo_movimento: new Date().toISOString() }).eq("id", pai);
  revalidatePath("/"); revalidatePath(`/item/${pai}`);
}

export async function criarTarefa(form: FormData) {
  const titulo = String(form.get("titulo") ?? "").trim();
  if (!titulo) return;
  const pai = String(form.get("projeto") ?? "") || null;
  const linkCru = String(form.get("link") ?? "").trim();
  const link = linkCru ? (/^https?:\/\//.test(linkCru) ? linkCru : `https://${linkCru}`) : null;
  const prazo = String(form.get("prazo") ?? "") || null;
  const sb = await createClient();
  let categoria_id: string | null = null;
  if (pai) { const { data: p } = await sb.from("itens").select("categoria_id").eq("id", pai).single(); categoria_id = p?.categoria_id ?? null; }
  await sb.from("itens").insert({ tipo: "tarefa", titulo: titulo.slice(0, 200), status: "ativo", prazo, link, pai_id: pai, categoria_id, origem: "manual" });
  if (pai) await sb.from("itens").update({ ultimo_movimento: new Date().toISOString() }).eq("id", pai);
  revalidatePath("/tarefas"); revalidatePath("/");
}

export async function reabrir(form: FormData) {
  const sb = await createClient();
  await sb.from("itens").update({ status: "ativo" }).eq("id", String(form.get("id")));
  revalidatePath("/tarefas"); revalidatePath("/");
}

export async function novoEvento(form: FormData) {
  const v = (k: string) => String(form.get(k) ?? "").trim();
  const sb = await createClient();
  let msg = "evento-criado";
  try { await criarEvento(sb, { titulo: v("titulo"), data: v("data"), inicio: v("inicio") || undefined, fim: v("fim") || undefined, local: v("local") }); }
  catch (e) { console.error("novoEvento", (e as Error).message); msg = "evento-erro"; }
  revalidateTag("agenda"); revalidatePath("/");
  redirect(`/?agenda=${msg}`);
}
