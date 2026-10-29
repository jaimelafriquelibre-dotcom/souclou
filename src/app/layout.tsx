import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOUCLOU — Gestion scolaire en Côte d’Ivoire",
  description:
    "SOUCLOU, une plateforme de gestion scolaire conçue pour les établissements ivoiriens.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr-CI" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
