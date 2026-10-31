/** Classificação inicial de apps e sites. Ajuste à vontade: o que não estiver aqui fica como "outro". */
const REGRAS: [RegExp, "produtivo" | "relaxamento" | "distracao" | "comunicacao"][] = [
  [/code|cursor|terminal|iterm|github|vercel|supabase|lovable|notion|obsidian|figma|canva|docs|sheets|excel|word|powerpoint|keynote|claude|chatgpt|gemini|granola|calendar|agenda|mail|gmail|segundo-cerebro/i, "produtivo"],
  [/whatsapp|telegram|slack|zoom|meet|teams|facetime|messages|mensagens/i, "comunicacao"],
  [/instagram|tiktok|twitter|x\.com|facebook|threads|reddit|youtube shorts|kwai/i, "distracao"],
  [/youtube|netflix|prime|disney|spotify|music|música|kindle|livros|books|steam|games|jogos|roll20|foundry|discord/i, "relaxamento"],
];
export const classificar = (app: string, site?: string | null) => REGRAS.find(([r]) => r.test(`${app} ${site ?? ""}`))?.[1] ?? "outro";
export const ROTULO_CLASSE: Record<string, string> = { produtivo: "Trabalho", comunicacao: "Comunicação", relaxamento: "Lazer", distracao: "Redes sociais", outro: "Outros" };
export const COR_CLASSE: Record<string, string> = { produtivo: "#13897e", comunicacao: "#5f5f5b", relaxamento: "#4b6fa8", distracao: "#b5560f", outro: "#bdbdb7" };
