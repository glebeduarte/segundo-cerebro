import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Linha = { id: string; tipo: string; titulo: string; status: string; pai_id: string | null; categoria_id: string | null; ultimo_movimento: string; criado_em: string; prazo: string | null; resumo: string | null; link: string | null; origem_ref: string | null };
export type Categoria = { id: string; nome: string; cor: string | null; ordem: number };

export async function tudo() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: itens }, { data: cats }, { data: conexoes }] = await Promise.all([
    sb.from("itens").select("id,tipo,titulo,status,pai_id,categoria_id,ultimo_movimento,criado_em,prazo,resumo,link,origem_ref").neq("status", "arquivado").limit(2000),
    sb.from("categorias").select("id,nome,cor,ordem").order("ordem"),
    sb.from("conexoes").select("de_id,para_id"),
  ]);
  return { itens: (itens ?? []) as Linha[], cats: (cats ?? []) as Categoria[], conexoes: conexoes ?? [] };
}
export const diasDesde = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
