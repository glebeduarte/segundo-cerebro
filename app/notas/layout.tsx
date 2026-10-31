import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarNota } from "./actions";

type N = { id: string; titulo: string; pai_id: string | null; categoria_id: string | null; tags: string[]; atualizado_em: string };

export default async function NotasLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: notas }, { data: cats }, { data: projetos }] = await Promise.all([
    sb.from("itens").select("id,titulo,pai_id,categoria_id,tags,atualizado_em").eq("tipo", "nota").neq("status", "arquivado").order("titulo"),
    sb.from("categorias").select("id,nome,cor").order("ordem"),
    sb.from("itens").select("id,titulo").eq("tipo", "projeto").neq("status", "arquivado"),
  ]);
  const ns = (notas ?? []) as N[];
  const ids = new Set(ns.map((n) => n.id));
  const filhas = (id: string) => ns.filter((n) => n.pai_id === id);
  const raiz = ns.filter((n) => !n.pai_id || !ids.has(n.pai_id));
  const tags = [...new Set(ns.flatMap((n) => n.tags))].sort();
  const grupos = [
    ...(cats ?? []).map((c) => ({ chave: c.id, nome: c.nome, cor: c.cor, notas: raiz.filter((n) => n.categoria_id === c.id) })),
    { chave: "sem", nome: "Sem área", cor: "#8c8c88", notas: raiz.filter((n) => !n.categoria_id) },
  ].filter((g) => g.notas.length);
  const projNome = (id: string | null) => projetos?.find((p) => p.id === id)?.titulo;
  const Arvore = ({ n, nivel }: { n: N; nivel: number }) => (
    <li>
      <Link href={`/notas/${n.id}`} style={{ paddingLeft: 8 + nivel * 14 }}>{n.titulo}{nivel === 0 && projNome(n.pai_id) ? <small> · {projNome(n.pai_id)}</small> : null}</Link>
      {filhas(n.id).length > 0 && <ul>{filhas(n.id).map((f) => <Arvore key={f.id} n={f} nivel={nivel + 1} />)}</ul>}
    </li>
  );
  return (
    <div className="notas-app">
      <aside className="notas-lado" aria-label="Notas">
        <p className="voltar"><Link href="/">← Hoje</Link></p>
        <div className="notas-topo"><h1>Notas</h1><form action={criarNota}><button className="btn primary">Nova nota</button></form></div>
        <form action="/notas" className="busca"><input name="q" placeholder="Buscar nas notas" aria-label="Buscar nas notas" /></form>
        {ns.length === 0 && <p className="empty">Nenhuma nota ainda.</p>}
        {grupos.map((g) => (
          <section key={g.chave} className="grupo">
            <h2><span className="ponto" style={{ background: g.cor ?? "#8c8c88" }} />{g.nome}</h2>
            <ul>{g.notas.map((n) => <Arvore key={n.id} n={n} nivel={0} />)}</ul>
          </section>
        ))}
        {tags.length > 0 && <section className="grupo"><h2>Tags</h2><p className="tags">{tags.map((t) => <Link key={t} href={`/notas?tag=${encodeURIComponent(t)}`}>#{t}</Link>)}</p></section>}
      </aside>
      <div className="notas-corpo">{children}</div>
    </div>
  );
}
