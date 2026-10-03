import Link from "next/link";

export default function Guide() {
  return <main className="dv2-guide dv2-container">
    <Link className="dv2-back" href="/v2">← Volver al inicio</Link>
    <p className="dv2-eyebrow">EL CRITERIO DATASEC</p>
    <h1>Lo que sabemos.<br/><em>Lo que no sabemos.</em></h1>
    <p className="dv2-lede">dataSec sirve para investigar antes de viajar o elegir dónde vivir. No califica personas, ni garantiza que un lugar sea seguro o peligroso.</p>
    <div className="dv2-guide-grid">
      <section><span>01 / INVESTIGA</span><h2>Empieza por una decisión</h2><p>Elige viaje o mudanza, una ciudad y un barrio o dirección. La selección acompaña todo el recorrido, también al compartirla.</p></section>
      <section><span>02 / COMPRUEBA</span><h2>Datos, no reputaciones</h2><p>Las cifras oficiales se muestran con su período, fuente, unidad y limitaciones. Un barrio obrero, un asentamiento o una mala fama histórica no son, por sí solos, pruebas de riesgo.</p></section>
      <section><span>03 / CONTEXTO</span><h2>Una calle no es una sentencia</h2><p>La precisión de los incidentes varía entre fuentes. Las ubicaciones británicas publicadas están anonimizadas. No etiquetamos calles para evitar sin evidencia local contrastada, pertinente y suficientemente precisa.</p></section>
      <section><span>04 / ELIGE</span><h2>Compara correctamente</h2><p>Comparamos el mismo indicador dentro de una ciudad e indicamos siempre los períodos. Transporte, servicios, vivienda y condiciones del entorno se incorporarán únicamente con datos verificables.</p></section>
    </div>
    <div className="dv2-guide-call"><strong>Estado actual</strong><p>Madrid y Londres tienen datos operativos. Las otras ciudades están en evaluación y no muestran puntuaciones ficticias.</p><Link href="/v2#ciudades">Consultar cobertura →</Link></div>
  </main>;
}
