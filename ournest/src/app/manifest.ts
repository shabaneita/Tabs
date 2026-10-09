import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "بيتنا — مالية البيت",
    short_name: "بيتنا",
    description: "ميزانية البيت المشتركة ومصاريفك الخاصة، في تطبيق واحد للزوجين.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f4ec",
    theme_color: "#f7f4ec",
    categories: ["finance", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "أضف مصروف", short_name: "مصروف", url: "/?add=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
