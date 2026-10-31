import type { Metadata, Viewport } from "next";
import "./globals.css";
import MenuMovel from "@/components/MenuMovel";

export const metadata: Metadata = { title: "Segundo cérebro", description: "Painel pessoal de Glebe Duarte" };
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
