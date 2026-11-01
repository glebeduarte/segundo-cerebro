import type { Metadata, Viewport } from "next";
import "./globals.css";
import MenuMovel from "@/components/MenuMovel";

export const metadata: Metadata = {
  metadataBase: new URL("https://segundo-cerebro-black.vercel.app"),
  title: "Segundo cérebro",
  description: "Painel pessoal de Glebe Duarte",
  appleWebApp: { capable: true, title: "Cérebro", statusBarStyle: "default" },
  openGraph: { title: "Segundo cérebro", description: "Projetos, agenda, reuniões e notas em um painel só.", type: "website", locale: "pt_BR", siteName: "Segundo cérebro" },
  twitter: { card: "summary_large_image", title: "Segundo cérebro", description: "Projetos, agenda, reuniões e notas em um painel só." },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f1f1ef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}<MenuMovel /></body>
    </html>
  );
}
