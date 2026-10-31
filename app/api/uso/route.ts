import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classificar } from "@/lib/classes";

export const runtime = "nodejs";

type Reg = { dispositivo?: string; app?: string; site?: string; inicio?: string; duracao_seg?: number };

/** Recebe uso de apps de fora do app: Atalhos do iPhone (uma abertura) ou o script do ActivityWatch (lotes por hora). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 401 });
  const corpo = await req.json().catch(() => null);
  const lista: Reg[] = Array.isArray(corpo) ? corpo : corpo?.registros ?? (corpo ? [corpo] : []);
  if (!lista.length) return NextResponse.json({ erro: "nada para gravar" }, { status: 400 });
  const registros = lista.slice(0, 2000).map((r) => ({
    dispositivo: r.dispositivo || "iphone",
    app: String(r.app ?? "").trim(),
    site: r.site ?? null,
    inicio: r.inicio ?? new Date().toISOString(),
    duracao_seg: r.duracao_seg ?? null,
    classe: classificar(String(r.app ?? ""), r.site),
  }));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("registrar_uso", { p_token: token, p_registros: registros });
  if (error) return NextResponse.json({ erro: error.message.includes("token") ? "token inválido" : "falha ao gravar" }, { status: error.message.includes("token") ? 401 : 500 });
  return NextResponse.json({ gravados: data });
}
