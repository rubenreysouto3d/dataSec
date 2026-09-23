import type { Metadata } from "next";
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
          <a className="brand" href="/">data<span>Sec</span></a>
          <nav>
            <a href="/#areas">Explore</a>
            <a href="/methodology">Methodology</a>
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
