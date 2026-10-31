"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { salvarNota, criarNota } from "@/app/notas/actions";

type Op = { id: string; nome: string };
type Props = {
  id: string; titulo: string; conteudo: string; categoria_id: string | null; pai_id: string | null;
  areas: Op[]; destinos: Op[]; titulos: { titulo: string; href: string }[];
};
type Modo = "escrever" | "ler" | "lado";

export default function Editor(p: Props) {
  const [titulo, setTitulo] = useState(p.titulo);
  const [texto, setTexto] = useState(p.conteudo);
  const [area, setArea] = useState(p.categoria_id ?? "");
  const [pai, setPai] = useState(p.pai_id ?? "");
  const [modo, setModo] = useState<Modo>("lado");
  const [estado, setEstado] = useState("Salvo");
  const [sug, setSug] = useState<{ q: string; ini: number } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const primeiro = useRef(true);

  useEffect(() => { if (matchMedia("(max-width: 900px)").matches) setModo("escrever"); }, []);

  // salvamento automático
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    setEstado("Salvando…");
    const t = setTimeout(async () => {
      const r = await salvarNota({ id: p.id, titulo, conteudo: texto, categoria_id: area || null, pai_id: pai || null });
      setEstado(r.ok ? `Salvo às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : `Erro ao salvar: ${r.erro}`);
    }, 800);
    return () => clearTimeout(t);
  }, [titulo, texto, area, pai, p.id]);

  // evita perder alteração ao sair
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (estado.startsWith("Salvando")) e.preventDefault(); };
    addEventListener("beforeunload", f); return () => removeEventListener("beforeunload", f);
  }, [estado]);

  const aplicar = useCallback((antes: string, depois = "", linha = false) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    let novo: string, cursorA: number, cursorB: number;
    if (linha) {
      const ini = v.lastIndexOf("\n", a - 1) + 1;
      const fim = v.indexOf("\n", b); const f = fim === -1 ? v.length : fim;
      const linhas = v.slice(ini, f).split("\n").map((l) => (l.startsWith(antes) ? l.slice(antes.length) : antes + l.replace(/^(#{1,3} |- \[[ x]\] |- |> )/, ""))).join("\n");
      novo = v.slice(0, ini) + linhas + v.slice(f); cursorA = ini; cursorB = ini + linhas.length;
    } else {
      const sel = v.slice(a, b) || "texto";
      novo = v.slice(0, a) + antes + sel + depois + v.slice(b); cursorA = a + antes.length; cursorB = cursorA + sel.length;
    }
    setTexto(novo);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursorA, cursorB); });
  }, []);

  const inserir = (s: string) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: a, value: v } = el;
    setTexto(v.slice(0, a) + s + v.slice(a));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + s.length, a + s.length); });
  };

  function teclas(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "b") { e.preventDefault(); aplicar("**", "**"); }
    if (mod && e.key === "i") { e.preventDefault(); aplicar("_", "_"); }
    if (mod && e.key === "k") { e.preventDefault(); aplicar("[[", "]]"); }
    if (e.key === "Enter" && !e.shiftKey) {
      const el = e.currentTarget, v = el.value, a = el.selectionStart;
      const ini = v.lastIndexOf("\n", a - 1) + 1, linha = v.slice(ini, a);
      const m = linha.match(/^(\s*)(- \[[ x]\] |- |\d+\. |> )(.*)$/);
      if (m) {
        e.preventDefault();
        if (!m[3].trim()) { setTexto(v.slice(0, ini) + v.slice(a)); requestAnimationFrame(() => el.setSelectionRange(ini, ini)); return; }
        const prox = m[2].startsWith("- [") ? "- [ ] " : /^\d+\. /.test(m[2]) ? `${parseInt(m[2]) + 1}. ` : m[2];
        const s = "\n" + m[1] + prox; setTexto(v.slice(0, a) + s + v.slice(a));
        requestAnimationFrame(() => el.setSelectionRange(a + s.length, a + s.length));
      }
    }
    if (e.key === "Tab") {
      e.preventDefault(); const el = e.currentTarget, v = el.value, a = el.selectionStart;
      const ini = v.lastIndexOf("\n", a - 1) + 1;
      if (e.shiftKey) { if (v.slice(ini, ini + 2) === "  ") { setTexto(v.slice(0, ini) + v.slice(ini + 2)); requestAnimationFrame(() => el.setSelectionRange(a - 2, a - 2)); } }
      else { setTexto(v.slice(0, ini) + "  " + v.slice(ini)); requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2)); }
    }
  }

  function digitou(v: string) {
    setTexto(v);
    const el = ta.current; if (!el) return;
    const a = el.selectionStart, antes = v.slice(Math.max(0, a - 80), a);
    const m = antes.match(/\[\[([^\]\n]*)$/);
    setSug(m ? { q: m[1].toLowerCase(), ini: a - m[1].length } : null);
  }
  const sugestoes = useMemo(() => sug ? p.titulos.filter((t) => t.titulo.toLowerCase().includes(sug.q) && t.titulo !== titulo).slice(0, 8) : [], [sug, p.titulos, titulo]);
  function escolher(t: string) {
    const el = ta.current; if (!el || !sug) return;
    const v = el.value, a = el.selectionStart, fecha = v.slice(a, a + 2) === "]]" ? 2 : 0;
    const novo = v.slice(0, sug.ini) + t + "]]" + v.slice(a + fecha);
    setTexto(novo); setSug(null);
    const pos = sug.ini + t.length + 2;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
  }

  // leitura: [[links]], #tags e checklists clicáveis
  const mapa = useMemo(() => new Map(p.titulos.map((t) => [t.titulo.toLowerCase(), t.href])), [p.titulos]);
  const md = useMemo(() => texto
    .replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_, alvo: string, rot?: string) => {
      const href = mapa.get(alvo.trim().toLowerCase()) ?? `/criar?titulo=${encodeURIComponent(alvo.trim())}`;
      return `[${rot ?? alvo}](${href})`;
    })
    .replace(/(^|\s)#([\p{L}\p{N}_-]{2,40})/gu, (_, s: string, t: string) => `${s}[#${t}](/notas?tag=${encodeURIComponent(t.toLowerCase())})`), [texto, mapa]);

  let caixa = -1;
  const alternar = (n: number) => {
    let i = -1;
    setTexto((v) => v.replace(/^(\s*- \[)([ xX])(\])/gm, (m, a, x, b) => (++i === n ? a + (x === " " ? "x" : " ") + b : m)));
  };

  const Leitura = (
    <article className="nota-leitura">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ href = "", children }) => href.startsWith("/criar?")
          ? <form action={criarNota} className="wl-form"><input type="hidden" name="titulo" value={decodeURIComponent(href.split("titulo=")[1] ?? "")} /><button className="wl novo" title="Criar esta nota">{children}</button></form>
          : href.startsWith("/")
          ? <Link href={href} prefetch={false} className={href.startsWith("/notas?tag") ? "tag" : "wl"}>{children}</Link>
          : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        input: (props) => { if (props.type !== "checkbox") return <input {...props} />; const n = ++caixa; return <input type="checkbox" checked={!!props.checked} onChange={() => alternar(n)} />; },
      }}>{md}</ReactMarkdown>
    </article>
  );

  return (
    <div className="editor">
      <div className="ed-topo">
        <input className="ed-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título da nota" placeholder="Título" />
        <span className="ed-estado" aria-live="polite">{estado}</span>
      </div>
      <div className="ed-meta">
        <label>Área<select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Sem área</option>{p.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
        <label>Dentro de<select value={pai} onChange={(e) => setPai(e.target.value)}><option value="">Nada (nota solta)</option>{p.destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
        <form action={criarNota}><input type="hidden" name="pai" value={p.id} /><button className="btn">Nova subnota</button></form>
        <div className="modos" role="group" aria-label="Modo">
          {(["escrever", "lado", "ler"] as Modo[]).map((m) => <button key={m} className={modo === m ? "on" : ""} onClick={() => setModo(m)}>{m === "lado" ? "Lado a lado" : m === "ler" ? "Ler" : "Escrever"}</button>)}
        </div>
      </div>
      {modo !== "ler" && (
        <div className="ed-barra" role="toolbar" aria-label="Formatação">
          <button onClick={() => aplicar("# ", "", true)} title="Título 1">H1</button>
          <button onClick={() => aplicar("## ", "", true)} title="Título 2">H2</button>
          <button onClick={() => aplicar("### ", "", true)} title="Título 3">H3</button>
          <button onClick={() => aplicar("**", "**")} title="Negrito (Ctrl+B)"><b>B</b></button>
          <button onClick={() => aplicar("_", "_")} title="Itálico (Ctrl+I)"><i>I</i></button>
          <button onClick={() => aplicar("- ", "", true)} title="Lista">Lista</button>
          <button onClick={() => aplicar("- [ ] ", "", true)} title="Checklist">Checklist</button>
          <button onClick={() => aplicar("> ", "", true)} title="Citação">Citação</button>
          <button onClick={() => aplicar("`", "`")} title="Código">Código</button>
          <button onClick={() => inserir("\n| Coluna | Coluna |\n| --- | --- |\n|  |  |\n")} title="Tabela">Tabela</button>
          <button onClick={() => aplicar("[[", "]]")} title="Link para nota (Ctrl+K)">[[ ]]</button>
        </div>
      )}
      <div className={`ed-area m-${modo}`}>
        {modo !== "ler" && (
          <div className="ed-escrita">
            <textarea ref={ta} value={texto} onChange={(e) => digitou(e.target.value)} onKeyDown={teclas} onBlur={() => setTimeout(() => setSug(null), 150)} spellCheck aria-label="Conteúdo da nota" />
            {sugestoes.length > 0 && (
              <ul className="ed-sug" role="listbox" aria-label="Ligar a">
                {sugestoes.map((s) => <li key={s.titulo}><button onMouseDown={(e) => { e.preventDefault(); escolher(s.titulo); }}>{s.titulo}</button></li>)}
              </ul>
            )}
          </div>
        )}
        {modo !== "escrever" && Leitura}
      </div>
    </div>
  );
}
