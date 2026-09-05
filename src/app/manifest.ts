import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kan NFL Pick'em",
    short_name: "Kan NFL",
    description: "Brother pick'em for the NFL regular season",
    start_url: "/",
    display: "standalone",
    background_color: "#111827",
    theme_color: "#111827",
    icons: [
      { src: "/file.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
