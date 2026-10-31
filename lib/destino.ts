export type ComLink = { id: string; link?: string | null; origem_ref?: string | null; pai_id?: string | null };

/** Para onde levar o clique: o link do item, o da origem, o do projeto pai, ou a página do item no app. */
export function destino(i: ComLink, pais: Map<string, ComLink> = new Map()) {
  const http = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : null);
  const pai = i.pai_id ? pais.get(i.pai_id) : undefined;
  const href = http(i.link) ?? http(i.origem_ref?.split("#")[0]) ?? http(pai?.link) ?? `/item/${i.id}`;
  return { href, externo: href.startsWith("http") };
}
