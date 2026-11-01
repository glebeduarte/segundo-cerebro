import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarLivro, statusLivro } from "../actions";

export const dynamic = "force-dynamic";
const TZ = "America/Fortaleza";
type L = { id: string; titulo: string; resumo: string | null; status: string; ultimo_movimento: string; link: string | null };

const GRUPOS = [
  { status: "ativo", nome: "Lendo" },
  { status: "pausado", nome: "Pausados" },
  { status: "ideia", nome: "Quero ler" },
  { status: "concluido", nome: "Lidos" },
];
const ACOES: Record<string, { status: string; rotulo: string }[]> = {
  ativo: [{ status: "concluido", rotulo: "Terminei" }, { status: "pausado", rotulo: "Pausar" }],
  pausado: [{ status: "ativo", rotulo: "Retomar" }, { status: "concluido", rotulo: "Terminei" }],
  ideia: [{ status: "ativo", rotulo: "Comecei" }],
  concluido: [{ status: "ativo", rotulo: "Reler" }],
};

export default async function Livros() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await sb.from("itens").select("id,titulo,resumo,status,ultimo_movimento,link").eq("tipo", "livro").neq("status", "arquivado").order("ultimo_movimento", { ascending: false }).limit(300);
  const livros = (data ?? []) as L[];
  const dias = (d: string) => Math.floor((Date.now() - +new Date(d)) / 86400000);
  const lendo = livros.filter((l) => l.status === "ativo").length;

  return (
    <main className="painel subpagina">
      <p className="voltar"><Link href="/">← Hoje</Link></p>
      <h1>Livros</h1>
      <p className="meta">{lendo} em leitura. Adicione aqui ou pela voz: &quot;anota o livro X, de Y, quero ler&quot;.</p>

      <form action={criarLivro} className="nova-tarefa novo-livro panel">
        <input name="titulo" required placeholder="Título do livro" aria-label="Título" autoComplete="off" />
        <input name="autor" placeholder="Autor (opcional)" aria-label="Autor" autoComplete="off" />
        <select name="status" defaultValue="ativo" aria-label="Situação">
          <option value="ativo">Lendo</option><option value="ideia">Quero ler</option><option value="pausado">Pausado</option><option value="concluido">Lido</option>
        </select>
        <button className="btn primary">Adicionar</button>
      </form>

      {livros.length === 0 && <p className="empty" style={{ marginTop: 16 }}>Nenhum livro registrado ainda.</p>}
      {GRUPOS.map((g) => {
        const itens = livros.filter((l) => l.status === g.status);
        if (!itens.length) return null;
        return (
          <section className="panel" key={g.status} aria-labelledby={`g-${g.status}`} style={{ marginTop: 16 }}>
            <div className="ph"><h2 id={`g-${g.status}`}>{g.nome}</h2><span className="pchip num">{itens.length}</span></div>
            <div className="rows">
              {itens.map((l) => {
                const d = dias(l.ultimo_movimento);
                return (
                  <div className="row livro" key={l.id}>
                    <Link className="t" href={`/item/${l.id}`} prefetch={false}>
                      <b>{l.titulo}</b>
                      <small>{l.resumo ? `${l.resumo} · ` : ""}{g.status === "concluido" ? `lido em ${new Date(l.ultimo_movimento).toLocaleDateString("pt-BR", { timeZone: TZ })}` : `${d} ${d === 1 ? "dia" : "dias"} sem movimento`}</small>
                    </Link>
                    <span className="acoes">
                      {ACOES[g.status].map((a) => (
                        <form action={statusLivro} key={a.status}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value={a.status} /><button className="btn">{a.rotulo}</button></form>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
