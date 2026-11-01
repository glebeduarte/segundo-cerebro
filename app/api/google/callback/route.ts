import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const volta = (msg: string) => NextResponse.redirect(`${origin}/?agenda=${encodeURIComponent(msg)}`);
  const state = (await cookies()).get("g_state")?.value;
  if (!state || state !== searchParams.get("state")) return volta("erro");
  const code = searchParams.get("code");
  if (!code) return volta("cancelado");

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${origin}/api/google/callback`, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) { console.error("google token", r.status, j.error); return volta("erro"); }
  let conta: string | null = null;
  try { conta = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString()).email ?? null; } catch {}
  const { error } = await sb.from("google_tokens").upsert({ user_id: user.id, refresh_token: j.refresh_token, conta, atualizado_em: new Date().toISOString() });
  if (error) { console.error("google_tokens", error.message); return volta("erro"); }
  const res = volta("conectada");
  res.cookies.delete("g_state");
  return res;
}
