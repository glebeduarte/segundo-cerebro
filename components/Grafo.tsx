"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum } from "d3-force";

export type No = {
  id: string; titulo: string; tipo: string; area: string | null; cor: string; parado: boolean; peso: number;
  dias: number; prazo: string | null; resumo: string | null; status: string; link: string | null; pai: string | null; abertas: number;
};
export type Aresta = { de: string; para: string };
type N = No & SimulationNodeDatum;
type Vista = { k: number; x: number; y: number };

const ROTULO: Record<string, string> = { area: "Núcleo", projeto: "Projeto", tarefa: "Tarefa", reuniao: "Reunião", conversa: "Conversa", ideia: "Ideia", livro: "Livro", nota: "Nota" };
const MIN = 0.4, MAX = 4;
const raio = (n: No) => (n.tipo === "area" ? 22 : n.tipo === "projeto" ? 9 + Math.min(10, n.peso * 1.6) : n.tipo === "reuniao" ? 5 : 4);

export default function Grafo({ nos, arestas, areas }: { nos: No[]; arestas: Aresta[]; areas: { nome: string; cor: string }[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [dim, setDim] = useState({ w: 1000, h: 640 });
  const [pos, setPos] = useState<N[]>([]);
  const [foco, setFoco] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>({ k: 1, x: 0, y: 0 });
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean } | null>(null);
  const pinca = useRef<{ d: number; k: number; cx: number; cy: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: Math.max(460, Math.min(760, el.clientWidth * 0.7)) }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ns: N[] = nos.map((n) => ({ ...n }));
    const ids = new Set(ns.map((n) => n.id));
    const ls = arestas.filter((a) => ids.has(a.de) && ids.has(a.para)).map((a) => ({ source: a.de, target: a.para }));
    const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const areaIdx = new Map(areas.map((a, i) => [a.nome, i]));
    const ang = (n: N) => ((areaIdx.get(n.area ?? "") ?? areas.length) / (areas.length + 1)) * Math.PI * 2;
    const R = Math.min(dim.w, dim.h) * 0.3;
    const sim = forceSimulation(ns)
      .force("link", forceLink(ls).id((d) => (d as N).id).distance(46).strength(0.7))
      .force("carga", forceManyBody().strength(-90))
      .force("centro", forceCenter(dim.w / 2, dim.h / 2))
      .force("x", forceX<N>((n) => n.tipo === "area" ? dim.w / 2 : dim.w / 2 + Math.cos(ang(n)) * R).strength((n) => (n.tipo === "area" ? 0.5 : 0.06)))
      .force("y", forceY<N>((n) => n.tipo === "area" ? dim.h / 2 : dim.h / 2 + Math.sin(ang(n)) * R).strength((n) => (n.tipo === "area" ? 0.5 : 0.06)))
      .force("colide", forceCollide<N>((n) => raio(n) + 4));
    if (reduz) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); setPos([...ns]); }
    else sim.on("tick", () => setPos([...ns]));
    return () => { sim.stop(); };
  }, [nos, arestas, areas, dim]);

  // zoom em torno de um ponto da tela
  const zoomEm = (fator: number, cx = dim.w / 2, cy = dim.h / 2) => setVista((v) => {
    const k = Math.min(MAX, Math.max(MIN, v.k * fator));
    const f = k / v.k;
    return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
  });
  const ponto = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * dim.w, y: ((e.clientY - r.top) / r.height) * dim.h };
  };
  const centrarEm = (n: N) => setVista((v) => ({ k: Math.max(v.k, 1.8), x: dim.w / 2 - (n.x ?? 0) * Math.max(v.k, 1.8), y: dim.h / 2 - (n.y ?? 0) * Math.max(v.k, 1.8) }));

  useEffect(() => {
    const el = svg.current; if (!el) return;
    const roda = (e: WheelEvent) => { e.preventDefault(); const p = ponto(e); zoomEm(Math.exp(-e.deltaY * 0.0015), p.x, p.y); };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  });

  function baixo(e: React.PointerEvent) {
    const p = ponto(e); toques.current.set(e.pointerId, p);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (toques.current.size === 2) {
      const [a, b] = [...toques.current.values()];
      pinca.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: vista.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: vista.x, vy: vista.y };
      arrasto.current = null;
    } else arrasto.current = { x: p.x, y: p.y, vx: vista.x, vy: vista.y, moveu: false };
  }
  function move(e: React.PointerEvent) {
    if (!toques.current.has(e.pointerId)) return;
    const p = ponto(e); toques.current.set(e.pointerId, p);
    if (pinca.current && toques.current.size === 2) {
      const [a, b] = [...toques.current.values()], c = pinca.current;
      const k = Math.min(MAX, Math.max(MIN, c.k * Math.hypot(a.x - b.x, a.y - b.y) / c.d)), f = k / c.k;
      setVista({ k, x: c.cx - (c.cx - c.vx) * f, y: c.cy - (c.cy - c.vy) * f });
    } else if (arrasto.current) {
      const a = arrasto.current, dx = p.x - a.x, dy = p.y - a.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) a.moveu = true;
      setVista((v) => ({ ...v, x: a.vx + dx, y: a.vy + dy }));
    }
  }
  function cima(e: React.PointerEvent) {
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) pinca.current = null;
    if (arrasto.current && !arrasto.current.moveu && (e.target as Element).tagName === "svg") setSel(null);
    if (toques.current.size === 0) arrasto.current = null;
  }

  const p = new Map(pos.map((n) => [n.id, n]));
  const ativo = sel ?? foco;
  const vizinhos = new Set<string>();
  if (ativo) { vizinhos.add(ativo); arestas.forEach((a) => { if (a.de === ativo) vizinhos.add(a.para); if (a.para === ativo) vizinhos.add(a.de); }); }
  const apagado = (id: string) => (ativo && !vizinhos.has(id)) || (filtro && p.get(id)?.area !== filtro);
  const s = sel ? p.get(sel) : null;
  const ligados = s ? pos.filter((n) => n.id !== s.id && vizinhos.has(n.id)) : [];

  return (
    <div className="grafo" ref={caixa}>
      <div className="legenda" role="group" aria-label="Filtrar por área">
        <button className={!filtro ? "on" : ""} onClick={() => setFiltro(null)}>Todas</button>
        {areas.map((a) => <button key={a.nome} className={filtro === a.nome ? "on" : ""} onClick={() => setFiltro(filtro === a.nome ? null : a.nome)}><span style={{ background: a.cor }} />{a.nome}</button>)}
        <span className="nota"><i className="anel" /> parado há mais de 14 dias</span>
      </div>
      <div className="palco">
        <svg ref={svg} width={dim.w} height={dim.h} viewBox={`0 0 ${dim.w} ${dim.h}`} role="img" aria-label="Mapa de conexões"
          onPointerDown={baixo} onPointerMove={move} onPointerUp={cima} onPointerCancel={cima} style={{ touchAction: "none", cursor: arrasto.current ? "grabbing" : "grab" }}>
          <g transform={`translate(${vista.x},${vista.y}) scale(${vista.k})`}>
            <g className="arestas">
              {arestas.map((a, i) => { const o = p.get(a.de), t = p.get(a.para); if (!o || !t || o.x == null || t.x == null) return null;
                return <line key={i} x1={o.x} y1={o.y} x2={t.x} y2={t.y} vectorEffect="non-scaling-stroke" className={apagado(a.de) || apagado(a.para) ? "fraca" : ativo && (a.de === ativo || a.para === ativo) ? "quente" : ""} />; })}
            </g>
            {pos.map((n) => n.x == null ? null : (
              <g key={n.id} className={`no t-${n.tipo}${apagado(n.id) ? " fraco" : ""}${sel === n.id ? " sel" : ""}`} transform={`translate(${n.x},${n.y})`}
                onMouseEnter={() => setFoco(n.id)} onMouseLeave={() => setFoco(null)}
                onPointerDown={(e) => e.stopPropagation()} onClick={() => setSel(sel === n.id ? null : n.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(n.id); } if (e.key === "Escape") setSel(null); }}
                tabIndex={0} role="button" aria-pressed={sel === n.id} aria-label={`${n.titulo}, ${ROTULO[n.tipo] ?? n.tipo}`}>
                {n.parado && <circle r={raio(n) + 4} className="anel" vectorEffect="non-scaling-stroke" />}
                <circle r={raio(n)} fill={n.tipo === "projeto" || n.tipo === "area" ? n.cor : "#fff"} stroke={n.cor} strokeWidth={n.tipo === "projeto" || n.tipo === "area" ? 0 : 1.6} vectorEffect="non-scaling-stroke" />
                {(n.tipo === "projeto" || n.tipo === "area" || ativo === n.id || vista.k > 1.8) && (
                  <text y={raio(n) + 13 / Math.max(1, vista.k * 0.8)} textAnchor="middle" style={{ fontSize: 12 / Math.max(1, vista.k * 0.8) }}>{n.titulo.length > 26 ? n.titulo.slice(0, 25) + "…" : n.titulo}</text>
                )}
              </g>
            ))}
          </g>
        </svg>

        <div className="zoom" role="group" aria-label="Zoom">
          <button onClick={() => zoomEm(1.4)} aria-label="Aproximar">+</button>
          <button onClick={() => zoomEm(1 / 1.4)} aria-label="Afastar">−</button>
          <button onClick={() => setVista({ k: 1, x: 0, y: 0 })} aria-label="Ver tudo" className="ajustar">⤢</button>
          <span className="nivel num">{Math.round(vista.k * 100)}%</span>
        </div>

        {s && (
          <aside className="detalhe" aria-label={`Detalhes de ${s.titulo}`}>
            <button className="fechar" onClick={() => setSel(null)} aria-label="Fechar">×</button>
            <p className="tipo"><span className="ponto" style={{ background: s.cor }} />{ROTULO[s.tipo] ?? s.tipo}{s.area ? ` · ${s.area}` : ""}</p>
            <h3>{s.titulo}</h3>
            {s.pai && <p className="linha">Dentro de {s.pai}</p>}
            <dl>
              <div><dt>Último movimento</dt><dd className={s.dias > 14 && s.tipo === "projeto" ? "alerta" : ""}>{s.dias === 0 ? "hoje" : `há ${s.dias} ${s.dias === 1 ? "dia" : "dias"}`}</dd></div>
              {s.prazo && <div><dt>Prazo</dt><dd>{s.prazo.split("-").reverse().join("/")}</dd></div>}
              {(s.tipo === "projeto") && <div><dt>Tarefas abertas</dt><dd className="num">{s.abertas}</dd></div>}
              <div><dt>Ligações</dt><dd className="num">{ligados.length}</dd></div>
              {s.status === "concluido" && <div><dt>Situação</dt><dd>concluído</dd></div>}
            </dl>
            {s.resumo && <p className="resumo">{s.resumo}</p>}
            {ligados.length > 0 && (
              <ul className="ligados">
                {ligados.slice(0, 6).map((l) => <li key={l.id}><button onClick={() => { setSel(l.id); centrarEm(l); }}><span className="ponto" style={{ background: l.cor }} />{l.titulo}<small>{ROTULO[l.tipo] ?? l.tipo}</small></button></li>)}
                {ligados.length > 6 && <li className="mais">e mais {ligados.length - 6}</li>}
              </ul>
            )}
            <div className="acoes">
              {s.link && <a className="btn primary" href={s.link} target="_blank" rel="noopener noreferrer">Abrir onde é feito ↗</a>}
              <Link className="btn" href={`/item/${s.id}`} prefetch={false}>Ver página</Link>
              <button className="btn" onClick={() => centrarEm(s)}>Centralizar</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
