import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cria uma nota e abre. Aceita ?titulo= (vindo de um [[link]]) e ?pai= (nota ou projeto). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const titulo = (u.searchParams.get("titulo") ?? "").trim().slice(0, 140) || "Nova nota";
  const pai = u.searchParams.get("pai");
  if (u.searchParams.get("titulo")) {
    const { data: existe } = await sb.from("itens").select("id").eq("titulo", titulo).neq("status", "arquivado").limit(1).maybeSingle();
    if (existe) return NextResponse.redirect(new URL(`/notas/${existe.id}`, req.url));
  }
  let categoria_id: string | null = null;
  if (pai) { const { data: p } = await sb.from("itens").select("categoria_id").eq("id", pai).single(); categoria_id = p?.categoria_id ?? null; }
  const { data, error } = await sb.from("itens").insert({ tipo: "nota", titulo, conteudo: `# ${titulo}\n\n`, status: "ativo", pai_id: pai, categoria_id, origem: "nota" }).select("id").single();
  if (error || !data) return NextResponse.redirect(new URL("/notas?erro=1", req.url));
  return NextResponse.redirect(new URL(`/notas/${data.id}`, req.url));
}
