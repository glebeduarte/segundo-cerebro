import type { SupabaseClient } from "@supabase/supabase-js";
import { agendaEntre } from "@/lib/agenda";

/**
 * Atualiza ultimo_movimento dos projetos a partir de sinais que o app enxerga:
 * compromissos passados da agenda, reuniões do Granola e commits no GitHub.
 * Um projeto casa com um sinal pelo título ou pelas tags (ex.: "jácome").
 * Tags no formato "repo:dono/nome" ligam o projeto a um repositório.
 * Só avança a data, nunca recua.
 */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();

type P = { id: string; titulo: string; tags: string[] | null; ultimo_movimento: string };

export async function sincronizarMovimento(sb: SupabaseClient) {
  const { data: projetos } = await sb.from("itens").select("id,titulo,tags,ultimo_movimento").eq("tipo", "projeto").in("status", ["ativo", "pausado", "parado"]);
  if (!projetos?.length) return;
  const chaves = (p: P) => [p.titulo, ...(p.tags ?? []).filter((t) => !t.startsWith("repo:"))].map(norm).filter((k) => k.length >= 4);
  const casa = (texto: string, p: P) => { const t = ` ${norm(texto)} `; return chaves(p).some((k) => t.includes(k)); };
  const novo = new Map<string, number>();
  const marca = (id: string, quando: number) => { if (quando <= Date.now() && quando > (novo.get(id) ?? 0)) novo.set(id, quando); };

  const agora = new Date();
  const [eventos, reunioes] = await Promise.all([
    agendaEntre(new Date(+agora - 14 * 86400000), agora).catch(() => null),
    sb.from("itens").select("titulo,resumo,pai_id,criado_em").eq("tipo", "reuniao").gte("criado_em", new Date(+agora - 30 * 86400000).toISOString()).then((r) => r.data ?? []),
  ]);
  for (const e of eventos ?? []) if (!e.diaInteiro) for (const p of projetos as P[]) if (casa(e.titulo, p)) marca(p.id, +e.fim);
  for (const r of reunioes) for (const p of projetos as P[]) if (r.pai_id === p.id || casa(r.titulo, p)) marca(p.id, +new Date(r.criado_em));

  const comRepo = (projetos as P[]).flatMap((p) => (p.tags ?? []).filter((t) => t.startsWith("repo:")).map((t) => ({ p, repo: t.slice(5) })));
  await Promise.all(comRepo.map(async ({ p, repo }) => {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
        headers: { accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
        next: { revalidate: 1800 },
      });
      if (!r.ok) return;
      const [c] = await r.json();
      if (c?.commit?.committer?.date) marca(p.id, +new Date(c.commit.committer.date));
    } catch {}
  }));

  const mudar = (projetos as P[]).filter((p) => (novo.get(p.id) ?? 0) > +new Date(p.ultimo_movimento));
  await Promise.all(mudar.map((p) => sb.from("itens").update({ ultimo_movimento: new Date(novo.get(p.id)!).toISOString() }).eq("id", p.id)));
  return mudar.length;
}
