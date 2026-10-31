import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destino } from "@/lib/destino";
import { salvarItem, novaTarefa, concluir, arquivar } from "../../actions";

export const dynamic = "force-dynamic";
const ROTULO: Record<string, string> = { projeto: "Projeto", tarefa: "Tarefa", ideia: "Ideia", nota: "Nota", livro: "Livro", reuniao: "Reunião", conversa: "Conversa", area: "Área", recurso: "Recurso", lazer: "Lazer" };
const data = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", day: "numeric", month: "short" });

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: i } = await sb.from("itens").select("*, categorias(nome)").eq("id", id).single();
  if (!i) notFound();
  const [{ data: filhos }, { data: pai }] = await Promise.all([
    sb.from("itens").select("id,tipo,titulo,resumo,status,prazo,link,origem_ref,pai_id,ultimo_movimento").eq("pai_id", id).neq("status", "arquivado").order("ultimo_movimento", { ascending: false }),
    i.pai_id ? sb.from("itens").select("id,titulo,link").eq("id", i.pai_id).single() : Promise.resolve({ data: null }),
  ]);
  const pais = new Map(pai ? [[pai.id, pai]] : []);
  const d = destino(i, pais);
  const tarefas = (filhos ?? []).filter((f) => f.tipo === "tarefa" && f.status !== "concluido");
  const outros = (filhos ?? []).filter((f) => !(f.tipo === "tarefa" && f.status !== "concluido"));
  const dias = Math.floor((Date.now() - +new Date(i.ultimo_movimento)) / 86400000);

  return (
    <main className="painel item-page">
      <p className="voltar"><Link href="/">← Hoje</Link>{pai && <> · <Link href={`/item/${pai.id}`}>{pai.titulo}</Link></>}</p>
      <h1>{i.titulo}</h1>
      <p className="meta">{ROTULO[i.tipo] ?? i.tipo}{i.categorias ? ` · ${i.categorias.nome}` : ""} · último movimento há {dias} {dias === 1 ? "dia" : "dias"}{i.prazo ? ` · prazo ${i.prazo.split("-").reverse().join("/")}` : ""}</p>
      <div className="acoes">
        {d.externo
          ? <a className="btn primary grande" href={d.href} target="_blank" rel="noopener noreferrer">Abrir onde isso é feito ↗</a>
          : <span className="aviso">Ainda não há um lugar definido para resolver isto. Cole o link abaixo.</span>}
        {i.tipo === "tarefa" && i.status !== "concluido" && <form action={concluir}><input type="hidden" name="id" value={i.id} /><button className="btn">Concluir</button></form>}
        <form action={arquivar}><input type="hidden" name="id" value={i.id} /><button className="btn">Arquivar</button></form>
      </div>

      <section className="grid">
        <section className="panel s8" aria-labelledby="h-tarefas">
          <div className="ph"><h2 id="h-tarefas">Tarefas</h2><span className="pchip num">{tarefas.length}</span></div>
          <div className="rows">
            {tarefas.length === 0 && <p className="empty">Nenhuma tarefa aberta.</p>}
            {tarefas.map((t) => {
              const dt = destino(t, new Map([[i.id, i]]));
              return (
                <div className="row" key={t.id}>
                  <form action={concluir}><input type="hidden" name="id" value={t.id} /><button className="check" aria-label={`Concluir ${t.titulo}`} /></form>
                  <span className="t">{dt.externo ? <a className="vai" href={dt.href} target="_blank" rel="noopener noreferrer"><b>{t.titulo}</b></a> : <Link className="vai" href={dt.href}><b>{t.titulo}</b></Link>}<small>{t.prazo ? `Vence ${t.prazo.split("-").reverse().slice(0, 2).join("/")}` : "Sem prazo"}{t.resumo ? ` · ${t.resumo}` : ""}</small></span>
                  <Link className="info" href={`/item/${t.id}`} aria-label="Detalhes"><svg viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="13" cy="8" r="1.2" /></svg></Link>
                </div>
              );
            })}
            {i.tipo === "projeto" && (
              <form action={novaTarefa} className="row nova"><input type="hidden" name="pai" value={i.id} /><input name="titulo" placeholder="Nova tarefa neste projeto" aria-label="Nova tarefa" autoComplete="off" /><button className="btn">Adicionar</button></form>
            )}
          </div>
        </section>

        <section className="panel s4" aria-labelledby="h-onde">
          <div className="ph"><h2 id="h-onde">Onde isso é feito</h2></div>
          <form action={salvarItem} className="campos">
            <input type="hidden" name="id" value={i.id} />
            <label>Link<input name="link" defaultValue={i.link ?? ""} placeholder="https://… (site, repositório, documento)" /></label>
            <label>Prazo<input name="prazo" type="date" defaultValue={i.prazo ?? ""} /></label>
            <label>Notas<textarea name="resumo" rows={3} defaultValue={i.resumo ?? ""} /></label>
            <button className="btn primary">Salvar</button>
          </form>
        </section>

        <section className="panel s12" aria-labelledby="h-hist">
          <div className="ph"><h2 id="h-hist">Reuniões, conversas e concluídos</h2><span className="pchip num">{outros.length}</span></div>
          <div className="rows">
            {outros.length === 0 && <p className="empty">Nada registrado ainda.</p>}
            {outros.map((o) => {
              const dt = destino(o, new Map([[i.id, i]]));
              return (
                <div className="row" key={o.id}>
                  <span className="time num">{data(o.ultimo_movimento)}</span>
                  <span className="t">{dt.externo ? <a className="vai" href={dt.href} target="_blank" rel="noopener noreferrer"><b>{o.titulo}</b></a> : <Link className="vai" href={dt.href}><b>{o.titulo}</b></Link>}<small>{ROTULO[o.tipo] ?? o.tipo}{o.status === "concluido" ? " · concluído" : ""}{o.resumo ? ` · ${o.resumo}` : ""}</small></span>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
