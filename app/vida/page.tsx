import Link from "next/link";
import { tudo, diasDesde } from "@/lib/dados";

export const dynamic = "force-dynamic";

export default async function Vida() {
  const { itens, cats } = await tudo();
  const recente = (d: string, n: number) => diasDesde(d) <= n;
  const areas = cats.map((c) => {
    const daqui = itens.filter((i) => i.categoria_id === c.id);
    const projetos = daqui.filter((i) => i.tipo === "projeto" && i.status !== "concluido").sort((a, b) => diasDesde(a.ultimo_movimento) - diasDesde(b.ultimo_movimento));
    return {
      ...c, projetos,
      parados: projetos.filter((p) => diasDesde(p.ultimo_movimento) > 14).length,
      tarefas: daqui.filter((i) => i.tipo === "tarefa" && i.status !== "concluido").length,
      mov7: daqui.filter((i) => recente(i.ultimo_movimento, 7)).length,
      mov30: daqui.filter((i) => recente(i.ultimo_movimento, 30)).length,
      reunioes30: daqui.filter((i) => i.tipo === "reuniao" && recente(i.ultimo_movimento, 30)).length,
    };
  });
  const total30 = areas.reduce((s, a) => s + a.mov30, 0);
  const max30 = Math.max(1, ...areas.map((a) => a.mov30));
  const semArea = itens.filter((i) => !i.categoria_id && i.status !== "concluido").length;
  const lider = [...areas].sort((a, b) => b.mov30 - a.mov30)[0];
  const esquecidas = areas.filter((a) => a.projetos.length && a.mov30 === 0).map((a) => a.nome);

  return (
    <main className="painel subpagina">
      <p className="voltar"><Link href="/">← Hoje</Link></p>
      <h1>Vida</h1>
      <p className="meta">
        Nos últimos 30 dias houve {total30} movimentos registrados{lider && lider.mov30 ? `, ${Math.round((lider.mov30 / Math.max(1, total30)) * 100)}% deles em ${lider.nome}` : ""}.
        {esquecidas.length ? ` Sem nenhum movimento no período: ${esquecidas.join(", ")}.` : ""}
        {semArea ? ` ${semArea} itens ainda sem área.` : ""}
      </p>

      <section className="panel" aria-labelledby="h-dist" style={{ marginTop: 20 }}>
        <div className="ph"><h2 id="h-dist">Movimento por área nos últimos 30 dias</h2><span className="pchip">tarefas, reuniões, conversas e projetos que mudaram</span></div>
        <div className="life">
          {areas.map((a) => (
            <div className="life-row vida-row" key={a.id}>
              <span><span className="ponto" style={{ background: a.cor ?? "#8c8c88" }} />{a.nome}</span>
              <span className="track"><span className="bar" style={{ width: `${Math.max(a.mov30 ? 2 : 0, (a.mov30 / max30) * 100)}%`, background: a.cor ?? "var(--accent)" }} /></span>
              <span className="p num">{a.mov30}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        {areas.map((a) => (
          <section className="panel s6" key={a.id} aria-labelledby={`h-${a.id}`}>
            <div className="ph"><h2 id={`h-${a.id}`}><span className="ponto" style={{ background: a.cor ?? "#8c8c88" }} />{a.nome}</h2><span className="pchip num">{a.projetos.length} projetos</span></div>
            <div className="numeros num">
              <span><b>{a.tarefas}</b> tarefas abertas</span>
              <span><b>{a.reunioes30}</b> reuniões em 30 dias</span>
              <span className={a.parados ? "alerta" : ""}><b>{a.parados}</b> parados</span>
            </div>
            <div className="rows">
              {a.projetos.length === 0 && <p className="empty">Nenhum projeto nesta área.</p>}
              {a.projetos.slice(0, 5).map((p) => {
                const d = diasDesde(p.ultimo_movimento);
                return <Link className="row" href={`/item/${p.id}`} key={p.id}><span className="t"><b>{p.titulo}</b><small>{d === 0 ? "movimento hoje" : `${d} ${d === 1 ? "dia" : "dias"} sem movimento`}</small></span>{d > 14 && <span className="tag" style={{ background: "#fff6e0", color: "#92400e" }}>parado</span>}</Link>;
              })}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
