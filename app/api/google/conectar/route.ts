import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { ESCOPO, googleConfigurado } from "@/lib/google";

export async function GET(req: Request) {
  const { origin } = new URL(req.url);
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigurado()) return new NextResponse("Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.", { status: 500 });
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/api/google/callback`, response_type: "code",
    scope: ESCOPO, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, login_hint: user.email ?? "",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
