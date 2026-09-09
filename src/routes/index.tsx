import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Provende — Inventaire & Production" },
      {
        name: "description",
        content:
          "Gérez votre inventaire de matières premières, vos formules et votre production d'aliments en un seul endroit.",
      },
      { property: "og:title", content: "Provende — Inventaire & Production" },
      {
        property: "og:description",
        content:
          "Gérez votre inventaire de matières premières, vos formules et votre production d'aliments en un seul endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/provende.html"
      title="Provende — Inventaire & Production"
      className="h-screen w-screen border-0"
    />
  );
}
