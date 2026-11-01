import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Segundo cérebro",
    short_name: "Cérebro",
    description: "Painel pessoal de Glebe Duarte",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f1ef",
    theme_color: "#f1f1ef",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
