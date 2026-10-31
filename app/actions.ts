"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/");
}

export async function concluir(form: FormData) {
  const id = String(form.get("id"));
  const sb = await createClient();
  const { data } = await sb.from("itens").update({ status: "concluido" }).eq("id", id).select("pai_id").single();
  if (data?.pai_id) await sb.from("itens").update({ ultimo_movimento: new Date().toISOString() }).eq("id", data.pai_id);
  revalidatePath("/");
}

export async function arquivar(form: FormData) {
  const sb = await createClient();
  await sb.from("itens").update({ status: "arquivado" }).eq("id", String(form.get("id")));
  revalidatePath("/");
}
