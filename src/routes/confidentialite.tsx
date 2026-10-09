import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Provende" },
      { name: "description", content: "Comment Provende collecte, protège et utilise vos données personnelles et professionnelles." },
      { property: "og:title", content: "Politique de confidentialité — Provende" },
      { property: "og:description", content: "Vos données restent privées : ce que Provende collecte et comment elles sont protégées." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const sections: [string, string][] = [
  ["Responsable du traitement", "Provende est édité par M'BOUA BOGUI BONY MAURICE. Contact : boguimaurice@gmail.com."],
  ["Données collectées", "Adresse e-mail, nom, nom de l'exploitation, ainsi que les données que vous saisissez : matières, fournisseurs, formules, productions, entrées, ventes et commandes. Les membres temporaires saisissent uniquement leur nom et les quantités du jour."],
  ["Finalités", "Fournir le service de gestion d'inventaire et de production, sécuriser votre compte, et permettre la confirmation des commandes par vos fournisseurs. Aucune publicité, aucune revente de données."],
  ["Isolation des comptes", "Chaque compte est strictement privé. Aucun autre utilisateur — administrateur compris — n'a accès à vos données."],
  ["Traitements automatisés", "Les documents que vous scannez et les questions posées à l'assistant sont analysés par un service d'intelligence artificielle uniquement pour produire la réponse demandée."],
  ["Conservation", "Vos données sont conservées tant que votre compte existe. Les liens de commande fournisseur expirent après 30 jours, les codes membres à minuit."],
  ["Vos droits", "Vous pouvez accéder à vos données, les exporter (JSON, CSV, Excel, PDF), les corriger ou demander la suppression de votre compte en écrivant à boguimaurice@gmail.com."],
  ["Sécurité", "Connexion chiffrée (HTTPS), mots de passe jamais stockés en clair, contrôle d'accès côté serveur pour chaque donnée."],
];

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-background px-5 py-12 text-foreground">
      <Link to="/" className="font-display text-lg">Provende</Link>
      <h1 className="mt-6 font-display text-3xl">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : 9 octobre 2026</p>
      {sections.map(([t, x]) => (
        <section key={t} className="mt-6">
          <h2 className="text-lg font-semibold">{t}</h2>
          <p className="mt-1 text-muted-foreground">{x}</p>
        </section>
      ))}
    </main>
  );
}
