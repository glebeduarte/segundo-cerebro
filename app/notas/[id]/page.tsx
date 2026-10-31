import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Editor from "@/components/Editor";

export const dynamic = "force-dynamic";

export default async function NotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: n } = await sb.from("itens").select("id,titulo,conteudo,categoria_id,pai_id,tipo").eq("id", id).single();
  if (!n) notFound();
  const [{ data: cats }, { data: todos }, { data: entram }] = await Promise.all([
    sb.from("categorias").select("id,nome").order("ordem"),
    sb.from("itens").select("id,titulo,tipo,pai_id").in("tipo", ["nota", "projeto", "tarefa", "reuniao", "ideia", "livro"]).neq("status", "arquivado").order("titulo").limit(1500),
    sb.from("conexoes").select("de_id").eq("para_id", id),
  ]);
  const lista = todos ?? [];
  const href = (i: { id: string; tipo: string }) => (i.tipo === "nota" ? `/notas/${i.id}` : `/item/${i.id}`);
  const ids = new Set((entram ?? []).map((c) => c.de_id));
  const backlinks = lista.filter((i) => ids.has(i.id));
  const subnotas = lista.filter((i) => i.tipo === "nota" && i.pai_id === id);
  const destinos = lista.filter((i) => i.id !== id && (i.tipo === "projeto" || i.tipo === "nota"))
    .map((i) => ({ id: i.id, nome: `${i.tipo === "projeto" ? "Projeto" : "Nota"}: ${i.titulo}` }));
  const pai = lista.find((i) => i.id === n.pai_id);

  return (
    <main className="painel nota-pagina">
      {pai && <p className="voltar"><Link href={href(pai)}>↑ {pai.titulo}</Link></p>}
      <Editor key={n.id} id={n.id} titulo={n.titulo} conteudo={n.conteudo ?? ""} categoria_id={n.categoria_id} pai_id={n.pai_id}
        areas={(cats ?? []).map((c) => ({ id: c.id, nome: c.nome }))} destinos={destinos}
        titulos={lista.filter((i) => i.id !== id).map((i) => ({ titulo: i.titulo, href: href(i) }))} />
      <section className="grid" style={{ marginTop: 20 }}>
        <section className="panel s6" aria-labelledby="h-sub">
          <div className="ph"><h2 id="h-sub">Subnotas</h2><span className="pchip num">{subnotas.length}</span></div>
          <div className="rows">
            {subnotas.length === 0 && <p className="empty">Nenhuma. Use “Nova subnota” para organizar em níveis.</p>}
            {subnotas.map((s) => <Link className="row" key={s.id} href={`/notas/${s.id}`}><span className="t"><b>{s.titulo}</b></span></Link>)}
          </div>
        </section>
        <section className="panel s6" aria-labelledby="h-back">
          <div className="ph"><h2 id="h-back">Mencionada em</h2><span className="pchip num">{backlinks.length}</span></div>
          <div className="rows">
            {backlinks.length === 0 && <p className="empty">Nenhuma nota aponta para esta ainda. Em outra nota, escreva [[{n.titulo}]].</p>}
            {backlinks.map((b) => <Link className="row" key={b.id} href={href(b)}><span className="t"><b>{b.titulo}</b><small>{b.tipo}</small></span></Link>)}
          </div>
        </section>
      </section>
    </main>
  );
}
