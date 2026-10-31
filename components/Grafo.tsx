"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum } from "d3-force";

export type No = { id: string; titulo: string; tipo: string; area: string | null; cor: string; parado: boolean; peso: number };
export type Aresta = { de: string; para: string };
type N = No & SimulationNodeDatum;

export default function Grafo({ nos, arestas, areas }: { nos: No[]; arestas: Aresta[]; areas: { nome: string; cor: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [dim, setDim] = useState({ w: 1000, h: 640 });
  const [pos, setPos] = useState<N[]>([]);
  const [foco, setFoco] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: Math.max(480, Math.min(760, el.clientWidth * 0.7)) }));
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
      .force("x", forceX<N>((n) => dim.w / 2 + Math.cos(ang(n)) * (n.tipo === "projeto" ? R : R * 1.1)).strength(0.06))
      .force("y", forceY<N>((n) => dim.h / 2 + Math.sin(ang(n)) * (n.tipo === "projeto" ? R : R * 1.1)).strength(0.06))
      .force("colide", forceCollide<N>((n) => raio(n) + 4));
    if (reduz) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); setPos([...ns]); }
    else sim.on("tick", () => setPos([...ns]));
    return () => { sim.stop(); };
  }, [nos, arestas, areas, dim]);

  const p = new Map(pos.map((n) => [n.id, n]));
  const vizinhos = new Set<string>();
  if (foco) { vizinhos.add(foco); arestas.forEach((a) => { if (a.de === foco) vizinhos.add(a.para); if (a.para === foco) vizinhos.add(a.de); }); }
  const visivel = (n: No) => !filtro || n.area === filtro;
  const apagado = (id: string) => (foco && !vizinhos.has(id)) || (filtro && p.get(id)?.area !== filtro);

  return (
    <div className="grafo" ref={ref}>
      <div className="legenda" role="group" aria-label="Filtrar por área">
        <button className={!filtro ? "on" : ""} onClick={() => setFiltro(null)}>Todas</button>
        {areas.map((a) => <button key={a.nome} className={filtro === a.nome ? "on" : ""} onClick={() => setFiltro(filtro === a.nome ? null : a.nome)}><span style={{ background: a.cor }} />{a.nome}</button>)}
        <span className="nota"><i className="anel" /> parado há mais de 14 dias</span>
      </div>
      <svg width={dim.w} height={dim.h} viewBox={`0 0 ${dim.w} ${dim.h}`} role="img" aria-label="Mapa de conexões entre projetos, tarefas e reuniões">
        <g className="arestas">
          {arestas.map((a, i) => { const s = p.get(a.de), t = p.get(a.para); if (!s || !t || s.x == null || t.x == null) return null;
            return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={apagado(a.de) || apagado(a.para) ? "fraca" : foco && (a.de === foco || a.para === foco) ? "quente" : ""} />; })}
        </g>
        {pos.map((n) => n.x == null ? null : (
          <g key={n.id} className={`no t-${n.tipo}${apagado(n.id) ? " fraco" : ""}`} transform={`translate(${n.x},${n.y})`}
            onMouseEnter={() => setFoco(n.id)} onMouseLeave={() => setFoco(null)} onFocus={() => setFoco(n.id)} onBlur={() => setFoco(null)}
            onClick={() => router.push(`/item/${n.id}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/item/${n.id}`); }}
            tabIndex={visivel(n) ? 0 : -1} role="link" aria-label={`${n.titulo}, ${n.tipo}`}>
            {n.parado && <circle r={raio(n) + 4} className="anel" />}
            <circle r={raio(n)} fill={n.tipo === "projeto" ? n.cor : "#fff"} stroke={n.cor} strokeWidth={n.tipo === "projeto" ? 0 : 1.6} />
            {(n.tipo === "projeto" || foco === n.id) && <text y={raio(n) + 14} textAnchor="middle">{n.titulo.length > 26 ? n.titulo.slice(0, 25) + "…" : n.titulo}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}
const raio = (n: No) => (n.tipo === "projeto" ? 9 + Math.min(10, n.peso * 1.6) : n.tipo === "reuniao" ? 5 : 4);
