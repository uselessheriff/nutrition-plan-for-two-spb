import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "nutrition-plan.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Питание на месяц для двоих — Санкт-Петербург",
    description:
      "Действующий бюджет, московская дата, актуальная неделя, подробные рецепты, закупки, остатки и история цен для двоих в Санкт-Петербурге.",
    openGraph: {
      title: "Питание на месяц для двоих",
      description:
        "Бюджет 25 000 ₽: текущая неделя по Москве, архив рецептов, закупки и память цен.",
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og-v2.png`,
          width: 1200,
          height: 630,
          alt: "Питание на месяц для двоих в Санкт-Петербурге",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Питание на месяц для двоих",
      description: "Факт прошедших недель, подробные рецепты, закупки, остатки и история цен.",
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
