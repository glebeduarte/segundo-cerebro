import ical, { type VEvent } from "node-ical";

export type Compromisso = { id: string; titulo: string; inicio: Date; fim: Date; diaInteiro: boolean; local?: string; link: string };

export function linkDoDia(d = new Date()) {
  const l = new Date(d.getTime() + OFFSET * 3600000);
  return `https://calendar.google.com/calendar/r/day/${l.getUTCFullYear()}/${l.getUTCMonth() + 1}/${l.getUTCDate()}`;
}

const OFFSET = -3; // America/Fortaleza, sem horário de verão

function limitesDoDia(agora = new Date()) {
  const local = new Date(agora.getTime() + OFFSET * 3600000);
  const ini = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET * 3600000);
  return { ini, fim: new Date(ini.getTime() + 86400000) };
}

export async function agendaDeHoje(): Promise<Compromisso[] | null> {
  const { ini, fim } = limitesDoDia();
  return agendaEntre(ini, fim);
}

export async function agendaEntre(ini: Date, fim: Date): Promise<Compromisso[] | null> {
  const url = process.env.GOOGLE_ICS_URL;
  if (!url) return null;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Agenda respondeu ${res.status}`);
  const dados = ical.sync.parseICS(await res.text());
  const conta = decodeURIComponent(url.match(/\/ical\/([^/]+)\//)?.[1] ?? "");
  const linkEvento = (uid: string, start: Date, recorrente: boolean) => {
    if (!uid.endsWith("@google.com") || !conta) return linkDoDia(start);
    let id = uid.replace("@google.com", "");
    if (recorrente) id += "_" + start.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    return `https://calendar.google.com/calendar/event?eid=${Buffer.from(`${id} ${conta}`).toString("base64").replace(/=+$/, "")}`;
  };
  const lista: Compromisso[] = [];

  for (const ev of Object.values(dados)) {
    if (!ev || ev.type !== "VEVENT") continue;
    const e = ev as VEvent;
    if ((e as unknown as { status?: string }).status === "CANCELLED") continue;
    const dur = (e.end ? +new Date(e.end) : +new Date(e.start)) - +new Date(e.start);
    const diaInteiro = (e.datetype as string) === "date";
    type Src = { summary?: unknown; location?: unknown };
    const add = (start: Date, src: Src) =>
      lista.push({ id: `${e.uid}-${+start}`, titulo: String((src.summary as { val?: string })?.val ?? src.summary ?? "Sem título"), inicio: start, fim: new Date(+start + dur), diaInteiro, local: src.location ? String((src.location as { val?: string })?.val ?? src.location) : undefined, link: linkEvento(String(e.uid), start, Boolean(e.rrule)) });

    if (e.rrule) {
      for (const d of e.rrule.between(new Date(+ini - dur), fim, true)) {
        const key = d.toISOString().slice(0, 10);
        if (e.exdate && Object.keys(e.exdate).some((k) => k.startsWith(key))) continue;
        const ov = e.recurrences?.[key] as unknown as (Src & { start: Date }) | undefined;
        const start = ov ? new Date(ov.start) : d;
        if (+start < +fim && +start + dur > +ini) add(start, ov ?? e);
      }
    } else {
      const s = new Date(e.start);
      if (+s < +fim && +s + Math.max(dur, 1) > +ini) add(s, e);
    }
  }
  return lista.sort((a, b) => Number(b.diaInteiro) - Number(a.diaInteiro) || +a.inicio - +b.inicio);
}
