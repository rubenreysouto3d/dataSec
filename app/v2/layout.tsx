import type { Metadata } from "next";
import Link from "next/link";
import "./v2.css";

export const metadata: Metadata = {
  title: "dataSec · Investiga un lugar",
  description: "El nuevo concepto de dataSec: información práctica, fuentes contrastadas y mapas para viajar o mudarte.",
  robots: { index: false, follow: false },
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dv2" id="main-content">
      <header className="dv2-top">
        <Link className="dv2-logo" href="/v2" aria-label="dataSec inicio">
          <span className="dv2-symbol" aria-hidden="true">◈</span>data<span>Sec</span><sup> BETA</sup>
        </Link>
        <nav aria-label="Navegación principal" className="dv2-mainnav">
          <Link href="/v2">Inicio</Link>
          <Link href="/v2#ciudades">Ciudades</Link>
          <Link href="/v2/saved">Guardados</Link>
        </nav>
        <Link className="dv2-top-help" href="/v2/guide">Cómo funciona <span aria-hidden="true">↗</span></Link>
      </header>
      {children}
      <footer className="dv2-footer">
        <span>dataSec · Comprender lugares, sin fingir certezas.</span>
        <div>
          <Link href="/v2/guide">Cómo funciona</Link>
          <Link href="/methodology">Fuentes y metodología</Link>
          <Link href="/privacy">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
