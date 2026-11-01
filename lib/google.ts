import type { SupabaseClient } from "@supabase/supabase-js";

/** Escrita no Google Agenda por OAuth. A leitura continua pelo iCal (lib/agenda.ts). */
export const ESCOPO = "https://www.googleapis.com/auth/calendar.events openid email";
const TZ = "America/Fortaleza";

export const googleConfigurado = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export async function agendaConectada(sb: SupabaseClient) {
  const { data } = await sb.from("google_tokens").select("conta").maybeSingle();
  return data ? { conta: data.conta as string | null } : null;
}

async function tokenDeAcesso(sb: SupabaseClient) {
  const { data } = await sb.from("google_tokens").select("refresh_token").maybeSingle();
  if (!data) throw new Error("Agenda ainda não autorizada para escrita. Conecte em Hoje > Agenda.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: data.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error === "invalid_grant" ? "A autorização do Google expirou. Conecte a agenda de novo." : `Google respondeu ${r.status}`);
  return j.access_token as string;
}

export type NovoEvento = { titulo: string; data: string; inicio?: string; fim?: string; duracaoMin?: number; local?: string; descricao?: string };

const somaMin = (hhmm: string, min: number) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + min;
  return { dia: Math.floor(t / 1440), hora: `${String(Math.floor((t % 1440) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` };
};
const maisDias = (data: string, n: number) => new Date(Date.parse(data + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export async function criarEvento(sb: SupabaseClient, e: NovoEvento) {
  const titulo = e.titulo.trim().slice(0, 200);
  if (!titulo) throw new Error("Faltou o título.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) throw new Error("Data inválida, use AAAA-MM-DD.");
  const hora = (h?: string) => (h && /^\d{2}:\d{2}$/.test(h) ? h : undefined);
  const ini = hora(e.inicio);
  let start, end;
  if (!ini) {
    start = { date: e.data };
    end = { date: maisDias(e.data, 1) };
  } else {
    let fim = hora(e.fim), diaFim = e.data;
    if (!fim || fim <= ini) { const s = somaMin(ini, fim ? 0 : e.duracaoMin ?? 60); fim = fim ?? s.hora; diaFim = maisDias(e.data, fim <= ini ? 1 : s.dia); }
    start = { dateTime: `${e.data}T${ini}:00`, timeZone: TZ };
    end = { dateTime: `${diaFim}T${fim}:00`, timeZone: TZ };
  }
  const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { authorization: `Bearer ${await tokenDeAcesso(sb)}`, "content-type": "application/json" },
    body: JSON.stringify({ summary: titulo, start, end, location: e.local?.trim() || undefined, description: e.descricao?.trim() || undefined }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google recusou o evento (${r.status}): ${j.error?.message ?? ""}`);
  return { id: j.id as string, link: j.htmlLink as string, titulo };
}
