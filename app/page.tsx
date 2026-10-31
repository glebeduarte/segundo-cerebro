import Script from "next/script";
import { redirect } from "next/navigation";
import { agendaDeHoje, linkDoDia, type Compromisso } from "@/lib/agenda";
import { destino } from "@/lib/destino";
import Link from "next/link";
import { capturar, classificar, concluir, arquivar } from "./actions";
import { createClient, supabaseReady } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Item = {
  id: string; tipo: string; titulo: string; resumo: string | null; status: string;
  prazo: string | null; origem: string | null; origem_ref: string | null; link: string | null; pai_id: string | null; ultimo_movimento: string; criado_em: string;
  categorias: { nome: string } | null;
};

const LIMITE = 14;
const DIA = 86400000;
const diasDesde = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DIA));
const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Fortaleza" });

type Cat = { id: string; nome: string };
async function carregar(): Promise<[Item[], Cat[]]> {
  if (!supabaseReady) return [[], []];
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await sb.from("itens")
    .select("id,tipo,titulo,resumo,status,prazo,origem,origem_ref,link,pai_id,ultimo_movimento,criado_em,categorias(nome)")
    .neq("status", "arquivado").order("ultimo_movimento", { ascending: false });
  const { data: cats } = await sb.from("categorias").select("id,nome").order("ordem");
  return [(data as unknown as Item[]) ?? [], (cats as Cat[]) ?? []];
}

export default async function Hoje() {
  const [itens, cats] = await carregar();
  const pais = new Map(itens.filter((i) => i.tipo === "projeto").map((p) => [p.id, p]));
  const Vai = ({ i, children }: { i: Item; children: React.ReactNode }) => {
    const d = destino(i, pais);
    return d.externo
      ? <a className="vai" href={d.href} target="_blank" rel="noopener noreferrer">{children}<svg className="seta" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" /></svg></a>
      : <Link className="vai" href={d.href}>{children}</Link>;
  };
  const Info = ({ i }: { i: Item }) => <Link className="info" href={`/item/${i.id}`} aria-label={`Detalhes de ${i.titulo}`}><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="13" cy="8" r="1.2" /></svg></Link>;
  let agenda: Compromisso[] | null = null, erroAgenda = false;
  try { agenda = await agendaDeHoje(); } catch { erroAgenda = true; }
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });
  const proximo = agenda?.find((c) => !c.diaInteiro && +c.fim > Date.now());
  const projetos = itens.filter((i) => i.tipo === "projeto" && ["ativo", "pausado", "parado"].includes(i.status));
  const parados = projetos.filter((p) => diasDesde(p.ultimo_movimento) > LIMITE);
  const hojeISO = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const tarefas = itens.filter((i) => i.tipo === "tarefa" && i.status !== "concluido" && (!i.prazo || i.prazo <= hojeISO));
  const entrada = itens.filter((i) => !i.categorias && i.tipo !== "projeto" && i.status !== "concluido");
  const reunioes = itens.filter((i) => i.tipo === "reuniao").slice(0, 3);
  const ideias = itens.filter((i) => i.tipo === "ideia");
  const livros = itens.filter((i) => i.tipo === "livro" && i.status === "ativo");
  const maisAntigo = parados.reduce((m, p) => Math.max(m, diasDesde(p.ultimo_movimento)), 0);
  const max = Math.max(80, Math.ceil(maisAntigo / 20) * 20);
  const comPrazo = tarefas.filter((t) => t.prazo).sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0];

  const achado = itens.length === 0
    ? "Ainda não há nada registrado. Comece pela caixa de entrada ou peça no chat para registrar um projeto."
    : comPrazo
      ? (() => { const hojeD = new Date(hojeISO + "T00:00:00Z").getTime(); const n = Math.round((new Date(comPrazo.prazo! + "T00:00:00Z").getTime() - hojeD) / DIA); return n < 0 ? `${comPrazo.titulo} venceu há ${-n} ${n === -1 ? "dia" : "dias"}.` : n === 0 ? `${comPrazo.titulo} vence hoje.` : `${comPrazo.titulo} vence em ${n} ${n === 1 ? "dia" : "dias"}.`; })()
      : `${projetos.length} projetos ativos.`;
  const sub = parados.length ? ` ${parados.length} ${parados.length === 1 ? "projeto está parado" : "projetos estão parados"} há mais de ${LIMITE} dias.` : "";

  const areas = {
    hoje: { n: String(tarefas.length), sub: `${tarefas.length} tarefas · ${agenda ? agenda.length : 0} compromissos`, msg: `${tarefas.length} tarefas hoje.${proximo ? ` Próximo compromisso: ${proximo.titulo} às ${hora(proximo.inicio)}.` : agenda ? " Sem compromissos pela frente." : ""}` },
    entrada: { n: String(entrada.length), msg: `${entrada.length} capturas esperando classificação.` },
    projetos: { n: String(projetos.length), sub: `${projetos.length} ativos`, msg: `${projetos.length} projetos ativos.` },
    parados: { n: String(parados.length), msg: parados[parados.length - 1] ? `${parados.length} parados. ${parados[parados.length - 1].titulo} está há ${maisAntigo} dias sem movimento.` : "Nenhum projeto parado." },
    reunioes: { n: String(reunioes.length), msg: reunioes[0] ? `${reunioes[0].titulo}: ${reunioes[0].resumo ?? "resumo importado"}` : "Nenhuma reunião importada ainda." },
    ideias: { n: String(ideias.length), msg: `${ideias.length} ideias guardadas.` },
    livros: { n: String(livros.length), msg: `${livros.length} livros em leitura.` },
    foco: { n: "—", sub: "sem dados ainda", msg: "Os registros de uso entram na fase 7." },
  };

  return (
    <>
      <header>
        <span className="brand"><span className="mark"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="5" cy="5" r="2" /><circle cx="11" cy="11" r="2" /><path d="M6.5 6.5l3 3" /></svg></span>Segundo cérebro</span>
        <nav><a href="#" aria-current="page">Hoje</a><a href="#h-mov">Projetos</a><Link href="/tarefas">Tarefas</Link><Link href="/notas">Notas</Link><Link href="/mapa">Mapa</Link><Link href="/vida">Vida</Link><a href="#">Foco</a></nav>
        <span className="kbd">Buscar em tudo<span>⌘ K</span></span>
      </header>

      <section className="stage" id="stage">
        <canvas id="orb" aria-label="Núcleo do segundo cérebro. Toque para falar." />
        <svg className="links" id="links" />
        <div className="left">
          <p className="date">{fmtData.format(new Date()).replace(/^./, (c) => c.toUpperCase())}</p>
          <h1>Bom dia, Glebe<b>.</b></h1>
          <p className="finding">{achado}<span>{sub}</span></p>
          <form className="ask" action={capturar}>
            <input id="q" name="texto" autoComplete="off" aria-label="Pergunte ou registre" placeholder="Pergunte ou registre algo" />
            <button type="button" id="mic" aria-label="Falar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></button>
          </form>
        </div>
        <div className="chips" id="chips" />
        <div className="toast" id="toast" />
        <div className="status"><span className="dot" />{supabaseReady ? "Conectado ao banco" : "Banco ainda não conectado"}</div>
      </section>

      <div className="painel" id="painel">
        <section className="grid" aria-label="Painel">
          <section className="panel s12" aria-labelledby="h-entrada">
            <div className="ph"><h2 id="h-entrada">Caixa de entrada</h2><span className="pchip num">{entrada.length}</span></div>
            <div className="rows">
              {entrada.length === 0 && <p className="empty">Tudo organizado. O que você registrar no campo do topo aparece aqui.</p>}
              {entrada.map((e) => (
                <div className="row inbox" key={e.id}>
                  <span className="t"><Vai i={e}><b>{e.titulo}</b></Vai><small>{e.tipo === "reuniao" ? "Reunião sem projeto" : "Capturado"} · {new Date(e.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}</small></span>
                  <form action={classificar} className="cls">
                    <input type="hidden" name="id" value={e.id} />
                    <select name="tipo" defaultValue={e.tipo === "nota" ? "tarefa" : e.tipo} aria-label="Tipo">
                      <option value="tarefa">Tarefa</option><option value="ideia">Ideia</option><option value="projeto">Projeto</option><option value="livro">Livro</option><option value="nota">Nota</option><option value="reuniao">Reunião</option>
                    </select>
                    <select name="categoria" required defaultValue="" aria-label="Área">
                      <option value="" disabled>Área</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <button className="btn primary">Organizar</button>
                  </form>
                  <form action={arquivar}><input type="hidden" name="id" value={e.id} /><button className="btn">Arquivar</button></form>
                </div>
              ))}
            </div>
          </section>

          <section className="panel s8" aria-labelledby="h-hoje">
            <div className="ph"><h2 id="h-hoje">Hoje</h2><span className="pchip num">{tarefas.length}</span><Link className="more" href="/tarefas">Todas as tarefas</Link></div>
            <div className="rows">
              {tarefas.length === 0 && <p className="empty">Nenhuma tarefa com prazo para hoje.</p>}
              {tarefas.slice(0, 6).map((t) => (
                <div className="row" key={t.id}><form action={concluir}><input type="hidden" name="id" value={t.id} /><button className="check" aria-label={`Concluir ${t.titulo}`} /></form><span className="t"><Vai i={t}><b>{t.titulo}</b></Vai><small>{t.prazo ? `Vence ${t.prazo.split("-").reverse().slice(0, 2).join("/")}` : "Sem prazo"}{t.pai_id && pais.get(t.pai_id) ? ` · ${pais.get(t.pai_id)!.titulo}` : t.categorias ? ` · ${t.categorias.nome}` : ""}</small></span><Info i={t} /></div>
              ))}
            </div>
          </section>

          <section className="panel s4" aria-labelledby="h-agenda">
            <div className="ph"><h2 id="h-agenda">Agenda</h2><span className="pchip num">{agenda?.length ?? 0}</span><a className="more" href={linkDoDia()} target="_blank" rel="noopener noreferrer">Abrir agenda</a></div>
            <div className="rows">
              {agenda === null && !erroAgenda && <p className="empty">Agenda ainda não conectada.</p>}
              {erroAgenda && <p className="empty">Não consegui ler a agenda agora. Tento de novo em alguns minutos.</p>}
              {agenda?.length === 0 && <p className="empty">Nenhum compromisso hoje.</p>}
              {agenda?.map((c) => (
                <a className="row" href={c.link} target="_blank" rel="noopener noreferrer" key={c.id} style={+c.fim < Date.now() ? { opacity: .5 } : undefined}>
                  <span className="time num">{c.diaInteiro ? "Dia" : hora(c.inicio)}</span>
                  <span className="t"><b>{c.titulo}</b><small>{c.diaInteiro ? "Dia inteiro" : `até ${hora(c.fim)}`}{c.local ? ` · ${c.local}` : ""}</small></span>
                </a>
              ))}
            </div>
          </section>

          <section className="panel s4" aria-labelledby="h-reu">
            <div className="ph"><h2 id="h-reu">Reuniões recentes</h2><span className="pchip">Granola</span></div>
            <div className="rows">
              {reunioes.length === 0 && <p className="empty">A importação do Granola entra na fase 4.</p>}
              {reunioes.map((r) => <div className="row" key={r.id}><span className="t"><Vai i={r}><b>{r.titulo}</b></Vai><small>{r.resumo}</small></span><Info i={r} /></div>)}
            </div>
          </section>

          <section className="panel s8" aria-labelledby="h-mov">
            <div className="ph"><h2 id="h-mov">Dias desde o último movimento</h2><span className="pchip num">{projetos.length} projetos</span></div>
            {projetos.length === 0 && <p className="empty">Nenhum projeto registrado ainda.</p>}
            <div className="lanes">
              {projetos.map((p) => {
                const d = diasDesde(p.ultimo_movimento); const s = d > LIMITE;
                return (
                  <div className={`lane${diasDesde(p.ultimo_movimento) > LIMITE ? " is-stale" : ""}`} key={p.id}>
                    <span className="n"><Link href={`/item/${p.id}`}>{p.titulo}</Link></span>
                    <span className="track"><span className={`bar${s ? " stale" : ""}`} style={{ width: `${Math.max(2, (d / max) * 100)}%` }} /><span className="limit" style={{ left: `${(LIMITE / max) * 100}%` }} /></span>
                    <span className={`d num${s ? " stale" : ""}`}>{d} {d === 1 ? "dia" : "dias"}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="panel s12" aria-labelledby="h-ideias">
            <div className="ph"><h2 id="h-ideias">Ideias e leituras</h2><span className="pchip num">{ideias.length + livros.length}</span></div>
            <div className="rows">
              {ideias.length + livros.length === 0 && <p className="empty">Nenhuma ideia ou livro ainda. Registre no campo do topo e organize como Ideia ou Livro.</p>}
              {[...livros, ...ideias].slice(0, 8).map((i) => <div className="row" key={i.id}><span className="t"><Vai i={i}><b>{i.titulo}</b></Vai><small>{i.tipo === "livro" ? "Livro em leitura" : "Ideia"}{i.categorias ? ` · ${i.categorias.nome}` : ""}</small></span><form action={arquivar}><input type="hidden" name="id" value={i.id} /><button className="btn">Arquivar</button></form></div>)}
            </div>
          </section>
        </section>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `window.__AREAS__=${JSON.stringify(areas)}` }} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="afterInteractive" />
      <Script src="/nucleo.js" strategy="lazyOnload" />
    </>
  );
}
