import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotasInicio({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const { q, tag } = await searchParams;
  const sb = await createClient();
  let query = sb.from("itens").select("id,titulo,conteudo,tags,atualizado_em").eq("tipo", "nota").neq("status", "arquivado").order("atualizado_em", { ascending: false }).limit(40);
  if (tag) query = query.contains("tags", [tag]);
  if (q) { const t = q.replace(/[%,()]/g, " ").trim(); query = query.or(`titulo.ilike.%${t}%,conteudo.ilike.%${t}%`); }
  const { data } = await query;
  const trecho = (c: string | null) => (c ?? "").replace(/^#.*$/m, "").replace(/[#*>`\[\]-]/g, "").trim().slice(0, 140);
  return (
    <main className="painel notas-lista">
      <h2 className="titulo-lista">{tag ? `#${tag}` : q ? `Busca: ${q}` : "Editadas recentemente"}</h2>
      <div className="rows">
        {!data?.length && <p className="empty">{q || tag ? "Nada encontrado." : "Crie sua primeira nota. Use [[Nome de outra nota]] para ligar notas e #tag para agrupar."}</p>}
        {data?.map((n) => (
          <Link className="row" key={n.id} href={`/notas/${n.id}`}>
            <span className="t"><b>{n.titulo}</b><small>{new Date(n.atualizado_em).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", day: "numeric", month: "short" })} · {trecho(n.conteudo) || "vazia"}</small></span>
          </Link>
        ))}
      </div>
    </main>
  );
}
