import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classificar, ROTULO_CLASSE, COR_CLASSE } from "@/lib/classes";

export const dynamic = "force-dynamic";
const TZ = "America/Fortaleza";
const CLASSES = ["produtivo", "comunicacao", "relaxamento", "distracao", "outro"];
const dia = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const horas = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")}` : `${Math.round(s / 60)} min`);

export default async function Foco() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: uso }, { data: tok }] = await Promise.all([
    sb.from("uso_apps").select("dispositivo,app,site,inicio,duracao_seg,classe").gte("inicio", desde).order("inicio").limit(20000),
    sb.from("tokens_uso").select("token").limit(1).maybeSingle(),
  ]);
  const regs = (uso ?? []).map((r) => ({ ...r, classe: r.classe ?? classificar(r.app, r.site), d: dia(r.inicio) }));
  const comp = regs.filter((r) => r.duracao_seg);
  const cel = regs.filter((r) => !r.duracao_seg);
  const dias = Array.from({ length: 7 }, (_, i) => dia(new Date(Date.now() - (6 - i) * 86400000)));
  const hoje = dias[6];

  const porDia = dias.map((d) => {
    const c = Object.fromEntries(CLASSES.map((k) => [k, comp.filter((r) => r.d === d && r.classe === k).reduce((s, r) => s + (r.duracao_seg ?? 0), 0)]));
    return { d, c, total: Object.values(c).reduce((a, b) => a + b, 0), aberturas: cel.filter((r) => r.d === d).length };
  });
  const maxDia = Math.max(1, ...porDia.map((p) => p.total));
  const h = porDia[6];
  const topApps = Object.entries(comp.filter((r) => r.d === hoje).reduce<Record<string, { s: number; c: string }>>((m, r) => { m[r.app] = { s: (m[r.app]?.s ?? 0) + (r.duracao_seg ?? 0), c: r.classe }; return m; }, {}))
    .sort((a, b) => b[1].s - a[1].s).slice(0, 8);
  const topCel = Object.entries(cel.filter((r) => r.d === hoje).reduce<Record<string, { n: number; c: string }>>((m, r) => { m[r.app] = { n: (m[r.app]?.n ?? 0) + 1, c: r.classe }; return m; }, {}))
    .sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const maxApp = Math.max(1, ...topApps.map(([, v]) => v.s));
  const maxCel = Math.max(1, ...topCel.map(([, v]) => v.n));
  const pct = (k: string) => (h.total ? Math.round((h.c[k] / h.total) * 100) : 0);
  const semDados = regs.length === 0;
  const url = "https://segundo-cerebro-black.vercel.app/api/uso";

  return (
    <main className="painel subpagina">
      <p className="voltar"><Link href="/">← Hoje</Link></p>
      <h1>Foco</h1>
      <p className="meta">
        {semDados ? "Ainda não chegou nenhum registro de uso. Configure o iPhone e o computador com as instruções abaixo." :
          `Hoje: ${horas(h.total)} no computador, ${pct("produtivo")}% em trabalho e ${pct("distracao")}% em redes sociais. ${h.aberturas} aberturas de apps registradas no iPhone.`}
      </p>

      <section className="grid" style={{ marginTop: 20 }}>
        <section className="panel s8" aria-labelledby="h-semana">
          <div className="ph"><h2 id="h-semana">Computador nos últimos 7 dias</h2></div>
          <div className="semana">
            {porDia.map((p) => (
              <div className="col" key={p.d} title={`${p.d}: ${horas(p.total)}`}>
                <div className="pilha" style={{ height: `${(p.total / maxDia) * 100}%` }}>
                  {CLASSES.map((k) => p.c[k] ? <span key={k} style={{ flexGrow: p.c[k], background: COR_CLASSE[k] }} /> : null)}
                </div>
                <small className="num">{p.total ? horas(p.total) : "—"}</small>
                <small>{new Date(p.d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small>
              </div>
            ))}
          </div>
          <p className="legenda-classes">{CLASSES.map((k) => <span key={k}><i style={{ background: COR_CLASSE[k] }} />{ROTULO_CLASSE[k]}</span>)}</p>
        </section>

        <section className="panel s4" aria-labelledby="h-hojeapps">
          <div className="ph"><h2 id="h-hojeapps">Apps no computador hoje</h2></div>
          <div className="life">
            {topApps.length === 0 && <p className="empty">Sem registros hoje.</p>}
            {topApps.map(([a, v]) => <div className="life-row" key={a}><span title={a}>{a}</span><span className="track"><span className="bar" style={{ width: `${(v.s / maxApp) * 100}%`, background: COR_CLASSE[v.c] }} /></span><span className="p num">{horas(v.s)}</span></div>)}
          </div>
        </section>

        <section className="panel s6" aria-labelledby="h-cel">
          <div className="ph"><h2 id="h-cel">iPhone hoje</h2><span className="pchip">aberturas por app</span></div>
          <div className="life">
            {topCel.length === 0 && <p className="empty">Sem registros hoje.</p>}
            {topCel.map(([a, v]) => <div className="life-row" key={a}><span>{a}</span><span className="track"><span className="bar" style={{ width: `${(v.n / maxCel) * 100}%`, background: COR_CLASSE[v.c] }} /></span><span className="p num">{v.n}×</span></div>)}
          </div>
        </section>

        <section className="panel s6" aria-labelledby="h-config">
          <div className="ph"><h2 id="h-config">Configurar</h2></div>
          <details className="config" open={semDados}>
            <summary>iPhone, pelo app Atalhos</summary>
            <ol>
              <li>Abra Atalhos, aba Automação, toque em <b>+</b> e escolha <b>App</b>.</li>
              <li>Selecione os apps que quer medir (Instagram, WhatsApp, YouTube…), marque <b>For aberto</b> e <b>Executar imediatamente</b>.</li>
              <li>Adicione a ação <b>Obter conteúdo do URL</b> com o endereço abaixo, método <b>POST</b>, corpo <b>JSON</b> com o campo <code>app</code> igual ao nome do app, e o cabeçalho <code>Authorization</code>.</li>
              <li>Repita para cada app, ou use um único atalho com a variável Nome do app, se o seu iOS oferecer.</li>
            </ol>
            <p className="campo"><span>URL</span><code>{url}</code></p>
            <p className="campo"><span>Authorization</span><code>Bearer {tok?.token ?? "—"}</code></p>
          </details>
          <details className="config">
            <summary>Computador, pelo ActivityWatch</summary>
            <ol>
              <li>Instale o ActivityWatch em activitywatch.net e deixe-o aberto.</li>
              <li>Baixe o script <code>scripts/activitywatch-sync.py</code> do repositório.</li>
              <li>Agende para rodar a cada hora: <code>SC_TOKEN={tok?.token ?? "…"} python3 activitywatch-sync.py</code></li>
            </ol>
          </details>
          <p className="aviso-token">Esse código dá acesso para gravar registros de uso. Não compartilhe.</p>
        </section>
      </section>
    </main>
  );
}
