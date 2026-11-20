import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/config/brand";
import { CANVAS } from "@/config/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT_NAME}: English spelling`,
    short_name: PRODUCT_NAME,
    description: "Master English spelling: short spelling games for Arabic speakers, with spaced review of your own mistakes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    dir: "rtl",
    lang: "ar",
    background_color: CANVAS,
    theme_color: CANVAS,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
