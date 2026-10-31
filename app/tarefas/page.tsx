import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarTarefa, concluir, reabrir } from "../actions";

export const dynamic = "force-dynamic";
const TZ = "America/Fortaleza";
type T = { id: string; titulo: string; prazo: string | null; link: string | null; origem_ref: string | null; pai_id: string | null; resumo: string | null; status: string; atualizado_em: string };

export default async function Tarefas({ searchParams }: { searchParams: Promise<{ projeto?: string }> }) {
  const { projeto } = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  let q = sb.from("itens").select("id,titulo,prazo,link,origem_ref,pai_id,resumo,status,atualizado_em").eq("tipo", "tarefa").in("status", ["ativo", "pausado", "parado", "ideia", "concluido"]).order("prazo", { ascending: true, nullsFirst: false }).limit(500);
  if (projeto) q = q.eq("pai_id", projeto);
  const [{ data }, { data: projetos }] = await Promise.all([q, sb.from("itens").select("id,titulo,link").eq("tipo", "projeto").neq("status", "arquivado").order("titulo")]);
  const tarefas = (data ?? []) as T[];
  const proj = new Map((projetos ?? []).map((p) => [p.id, p]));
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const em7 = new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  const abertas = tarefas.filter((t) => t.status !== "concluido");
  const grupos = [
    { nome: "Atrasadas", itens: abertas.filter((t) => t.prazo && t.prazo < hoje), alerta: true },
    { nome: "Hoje", itens: abertas.filter((t) => t.prazo === hoje) },
    { nome: "Próximos 7 dias", itens: abertas.filter((t) => t.prazo && t.prazo > hoje && t.prazo <= em7) },
    { nome: "Depois", itens: abertas.filter((t) => t.prazo && t.prazo > em7) },
    { nome: "Sem prazo", itens: abertas.filter((t) => !t.prazo) },
  ];
  const feitas = tarefas.filter((t) => t.status === "concluido").sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em)).slice(0, 10);
  const dia = (d: string) => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; };
  const destino = (t: T) => t.link ?? (t.origem_ref?.startsWith("http") ? t.origem_ref.split("#")[0] : null) ?? (t.pai_id ? proj.get(t.pai_id)?.link : null) ?? null;
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "link"; } };

  const Linha = ({ t }: { t: T }) => {
    const d = destino(t);
    const p = t.pai_id ? proj.get(t.pai_id) : null;
    return (
      <div className="row tarefa">
        <form action={concluir}><input type="hidden" name="id" value={t.id} /><button className="check" aria-label={`Concluir ${t.titulo}`} /></form>
        <Link className="t" href={`/item/${t.id}`} prefetch={false}>
          <b>{t.titulo}</b>
          <small>{t.prazo ? dia(t.prazo) : "sem prazo"}{p ? ` · ${p.titulo}` : ""}{t.resumo ? ` · ${t.resumo}` : ""}</small>
        </Link>
        {d ? <a className="abrir" href={d} target="_blank" rel="noopener noreferrer" title={d}>{host(d)} ↗</a> : <Link className="abrir interno" href={`/item/${t.id}`} prefetch={false}>Resolver aqui</Link>}
      </div>
    );
  };

  return (
    <main className="painel subpagina">
      <p className="voltar"><Link href="/">← Hoje</Link></p>
      <h1>Tarefas</h1>
      <p className="meta">{abertas.length} abertas{grupos[0].itens.length ? `, ${grupos[0].itens.length} atrasadas` : ""}. Tarefas com link abrem onde são feitas; as outras abrem aqui no app.</p>

      <form action={criarTarefa} className="nova-tarefa panel">
        <input name="titulo" required placeholder="O que precisa ser feito?" aria-label="Tarefa" autoComplete="off" />
        <input name="prazo" type="date" aria-label="Prazo" />
        <select name="projeto" defaultValue={projeto ?? ""} aria-label="Projeto"><option value="">Sem projeto</option>{(projetos ?? []).map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select>
        <input name="link" type="url" placeholder="Link onde é feita (opcional)" aria-label="Link" inputMode="url" />
        <button className="btn primary">Adicionar</button>
      </form>

      <form className="filtro" action="/tarefas">
        <select name="projeto" defaultValue={projeto ?? ""} aria-label="Filtrar por projeto"><option value="">Todos os projetos</option>{(projetos ?? []).map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select>
        <button className="btn">Filtrar</button>
      </form>

      {grupos.filter((g) => g.itens.length).map((g) => (
        <section className="panel" key={g.nome} aria-labelledby={`g-${g.nome}`} style={{ marginTop: 16 }}>
          <div className="ph"><h2 id={`g-${g.nome}`} className={g.alerta ? "alerta" : ""}>{g.nome}</h2><span className="pchip num">{g.itens.length}</span></div>
          <div className="rows">{g.itens.map((t) => <Linha key={t.id} t={t} />)}</div>
        </section>
      ))}
      {abertas.length === 0 && <p className="empty" style={{ marginTop: 16 }}>Nenhuma tarefa aberta.</p>}

      {feitas.length > 0 && (
        <section className="panel" aria-labelledby="g-feitas" style={{ marginTop: 16 }}>
          <div className="ph"><h2 id="g-feitas">Concluídas recentemente</h2></div>
          <div className="rows">
            {feitas.map((t) => (
              <div className="row feita" key={t.id}>
                <span className="t"><b>{t.titulo}</b><small>{t.pai_id ? proj.get(t.pai_id)?.titulo : ""}</small></span>
                <form action={reabrir}><input type="hidden" name="id" value={t.id} /><button className="btn">Reabrir</button></form>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
