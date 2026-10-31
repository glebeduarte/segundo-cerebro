import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Liga um item ao contexto dele assim que é criado ou reclassificado:
 * projetos entram no núcleo que agrupa a área deles (ex.: "Meu negócio" agrupa Clientes, Produtos próprios e Expoeduc),
 * e itens citados pelo nome viram conexões "relacionado".
 */
export async function conectarNoContexto(sb: SupabaseClient, id: string, relacionados: string[] = []) {
  const { data: item } = await sb.from("itens").select("id,tipo,categoria_id,categorias(nome)").eq("id", id).single();
  if (!item) return;
  const linhas: { de_id: string; para_id: string; relacao: string }[] = [];
  const cat = (item.categorias as unknown as { nome: string } | null)?.nome?.toLowerCase();
  if (item.tipo === "projeto" && cat) {
    const { data: nucleos } = await sb.from("itens").select("id").eq("tipo", "area").neq("status", "arquivado").contains("tags", [cat]);
    (nucleos ?? []).forEach((n) => linhas.push({ de_id: n.id, para_id: id, relacao: "parte_de" }));
  }
  const nomes = relacionados.map((r) => r.trim()).filter(Boolean).slice(0, 8);
  if (nomes.length) {
    const { data: achados } = await sb.from("itens").select("id,titulo").in("titulo", nomes).neq("status", "arquivado");
    (achados ?? []).filter((a) => a.id !== id).forEach((a) => linhas.push({ de_id: id, para_id: a.id, relacao: "relacionado" }));
  }
  if (linhas.length) await sb.from("conexoes").upsert(linhas, { onConflict: "de_id,para_id,relacao", ignoreDuplicates: true });
}
