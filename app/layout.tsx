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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">data<span>Sec</span></Link>
          <nav aria-label="Primary navigation">
            <Link href="/#areas">Cities</Link>
            <Link href="/methodology">About</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p><strong>dataSec</strong> · Official local safety context.</p>
          <p>London · Madrid</p>
        </footer>
      </body>
    </html>
  );
}
