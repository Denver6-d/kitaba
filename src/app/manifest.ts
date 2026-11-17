import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kitaba كتابة",
    short_name: "Kitaba",
    description: "English writing practice for Arabic speakers: typing, spelling, sentences and professional writing.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#eef1ec",
    theme_color: "#14302e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
