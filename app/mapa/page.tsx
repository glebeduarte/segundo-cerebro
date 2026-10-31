import Link from "next/link";
import Grafo, { type No, type Aresta } from "@/components/Grafo";
import { tudo, diasDesde } from "@/lib/dados";

export const dynamic = "force-dynamic";

export default async function Mapa() {
  const { itens, cats, conexoes } = await tudo();
  const cor = (id: string | null) => cats.find((c) => c.id === id)?.cor ?? "#8c8c88";
  const nome = (id: string | null) => cats.find((c) => c.id === id)?.nome ?? null;
  const vivos = itens.filter((i) => i.status !== "concluido" || i.tipo === "reuniao" || i.tipo === "conversa");
  const filhos = (id: string) => vivos.filter((i) => i.pai_id === id).length;
  const nos: No[] = vivos.filter((i) => ["projeto", "tarefa", "reuniao", "conversa", "ideia", "livro"].includes(i.tipo) && (i.tipo === "projeto" || i.pai_id))
    .map((i) => ({ id: i.id, titulo: i.titulo, tipo: i.tipo, area: nome(i.categoria_id), cor: cor(i.categoria_id), parado: i.tipo === "projeto" && i.status === "ativo" && diasDesde(i.ultimo_movimento) > 14, peso: filhos(i.id) }));
  const arestas: Aresta[] = [
    ...vivos.filter((i) => i.pai_id).map((i) => ({ de: i.pai_id!, para: i.id })),
    ...conexoes.map((c) => ({ de: c.de_id, para: c.para_id })),
  ];
  const projetos = nos.filter((n) => n.tipo === "projeto");
  const soltos = projetos.filter((p) => !arestas.some((a) => a.de === p.id || a.para === p.id));
  return (
    <main className="painel subpagina">
      <p className="voltar"><Link href="/">← Hoje</Link></p>
      <h1>Mapa</h1>
      <p className="meta">{projetos.length} projetos, {nos.length - projetos.length} itens ligados a eles. {soltos.length} projetos ainda sem nenhuma tarefa, reunião ou conversa: {soltos.slice(0, 6).map((s) => s.titulo).join(", ")}{soltos.length > 6 ? "…" : ""}.</p>
      <section className="panel" aria-labelledby="h-grafo" style={{ marginTop: 20 }}>
        <div className="ph"><h2 id="h-grafo">Conexões</h2><span className="pchip">passe o mouse para ver as ligações, clique para abrir</span></div>
        <Grafo nos={nos} arestas={arestas} areas={cats.map((c) => ({ nome: c.nome, cor: c.cor ?? "#8c8c88" }))} />
      </section>
    </main>
  );
}
