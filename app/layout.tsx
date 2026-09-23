import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "dataSec — Urban safety, from official data",
    template: "%s — dataSec",
  },
  description:
    "Explore neighbourhood-level urban safety data from official public sources, with transparent methodology and source quality.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">data<span>Sec</span></Link>
          <nav>
            <Link href="/#areas">Explore</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/methodology">Methodology</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Official data, translated into useful local context.</p>
          <p>Prototype · London / Metropolitan Police</p>
        </footer>
      </body>
    </html>
  );
}
