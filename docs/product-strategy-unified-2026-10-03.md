> **SUPERSEDED — 2026-10-05.** This product direction is retained for history only. Do not use it as the current design/product brief. The canonical direction is [Product foundation reset](product-foundation-2026-10-05.md).\n\n# DataSec: producto unificado (3 octubre 2026)

**Estado:** propuesta estratégica documentada, no implementación ni autorización de publicar afirmaciones nuevas sobre seguridad.

## Diagnóstico
La web pública, el experimento Atlas, la extensión de Booking/Airbnb y el widget B2B se han diseñado como superficies, sin definir un recorrido comercial único. La base de datos y la ingestión son activos; otro cambio de CSS no arregla este problema.

## Promesa
DataSec ayuda a investigar un lugar concreto antes de visitarlo o vivir en él, con datos oficiales verificables, contexto geográfico y limitaciones visibles. No predice la seguridad personal ni certifica barrios, alojamientos o rutas seguros. Los incidentes por km², las tasas por residentes y las encuestas no se funden en un score inventado.

La unidad fundamental es una **ficha de lugar** estable y enlazable. El mapa descubre; la ficha interpreta; la comparación apoya una decisión.

## Dos trabajos, un producto
- **Voy de viaje:** buscar barrio, dirección o alojamiento; ver el contexto registrado pertinente para visitas, contrastar zonas y, opcionalmente, visitar ofertas externas de alojamiento claramente identificadas como enlaces de afiliación.
- **Estoy pensando en vivir allí:** explorar indicadores apropiados para residentes, período, contexto disponible y comparar lugares de la misma ciudad usando el mismo indicador. Nada de comparativas engañosas Madrid-Londres.

El cambio de intención nunca descarta el lugar elegido. Cada indicador aclara observación, fuente, período, unidad, denominador, cobertura y limitaciones. La falta de datos no se pinta de verde ni se confunde con cero.

## Experiencia de extremo a extremo
1. Una sola entrada: **buscar ciudad, barrio, dirección o alojamiento**, con intención visita/residencia.
2. Mapa navegable, zona administrativa/policial resaltada y selección directa.
3. Ficha con el valor principal *nombrado*, el período, el significado exacto de la escala cromática y un enlace a fuente; contexto y cautelas junto a la cifra, no ocultos.
4. Comparar una segunda zona con medidas realmente comparables; guardar, compartir o continuar la investigación.
5. Modalidad visita: enlace externo opcional que no altera ni el mapa ni los datos; modalidad residencia: historial y contexto municipal cuando haya datos compatibles.
6. La metodología detallada y todas las capas analíticas quedan como segunda profundidad, no como requisito para entender la pantalla.

## Superficies y función
| Superficie | Función |
| --- | --- |
| **Web pública e indexable** | Adquisición orgánica por consultas sobre ciudades y zonas cubiertas. Búsqueda, ficha canónica, mapa y comparación públicos. No fabricar páginas vacías para SEO. |
| **PWA móvil** | **La misma web y base de código**, instalada en móvil. Navegación táctil, fichas compartidas, consultas recientes y, después, guardados opcionales. No crear app nativa hasta demostrar una necesidad que la PWA no cubra. |
| **Extensión de alojamientos** | Distribución contextual: dirección precisa voluntariamente disponible -> misma ficha de visitante. Si se oculta la dirección, no inventarla. No representa integración oficial con plataformas. |
| **Widget B2B** | Fragmento del mismo objeto de evidencia, con fuente, límites y marca visibles para operadores turísticos o inmobiliarios, sujeto a acuerdos y revisión legal. |

**Arquitectura:** fuentes oficiales -> adaptadores por ciudad -> objeto canónico de evidencia con identidad geográfica, indicadores, fuente, período, calidad y limitaciones -> web/PWA/extensión/widget. El mismo identificador, cálculo y fecha deben producir el mismo resultado en las cuatro superficies. Geocodificación y búsqueda son un servicio compartido, no cuatro implementaciones.

## Monetización condicionada a valor probado
| Línea | Hipótesis y orden |
| --- | --- |
| **Afiliados para viajeros** | Primera prueba de ingresos: enlaces identificados a alojamientos después de aportar la información. Booking mantiene un programa de afiliación sujeto a admisión y reservas elegibles. Airbnb limita sus programas a candidatos seleccionados; no presupuestar comisiones allí. No permitir que la comisión influya en medidas, selección ni orden de zonas. |
| **Widget o licencia B2B** | Pilotos cuando las fichas y la cobertura sean fiables. Se cobra integración/servicio, no una supuesta certificación de seguridad. Revisar licencias originales y cartográficas, protección de datos, límites de consumo y responsabilidad. |
| **Premium individual** | Solo cuando los usuarios demuestren necesidad de comparaciones avanzadas, colecciones o exportaciones. Nunca poner los hechos básicos o advertencias tras el pago; no vender alertas de peligro sin fuentes en tiempo real. |
| **Publicidad contextual** | Alternativa posterior cuando haya suficiente tráfico y se compruebe que no contamina la experiencia ni destruye confianza. No convertir el mapa crítico en soporte publicitario. |

**Fuentes comerciales comprobadas el 03/10/2026:**
- Booking: https://www.booking.com/affiliate-program/v2/index.es.html
- Airbnb: https://es.airbnb.com/help/article/4236

No existe proyección de ingresos válida antes de conocer elegibilidad, tráfico cualificado, conversión, costes de geocodificación y voluntad de pago de socios.

## Prioridades de ejecución
**Fase 1 — producto probado:** diseñar en serio *un* recorrido móvil/escritorio: buscar alojamiento en Madrid -> abrir ficha -> comprender medida -> comparar zona -> compartir. Probar por separado el flujo «elegir barrio donde vivir» y su metodología. No reemplazar producción hasta que ambas tareas funcionen con usuarios reales.

**Fase 2 — consolidación técnica:** estabilizar y probar un contrato interno de ficha; resolver alias/direcciones de forma comercialmente viable; construir una única experiencia responsiva; probar identidad de cifras y advertencias en mapa, ficha, comparación y widget. Conservar los pipelines Supabase/PostGIS, sus pruebas y la transparencia de fuentes.

**Fase 3 — distribución:** convertir la experiencia en PWA instalada y comprobada en iOS/Android, activar enlaces afiliados solo después de aceptación y revisión de condiciones, adaptar la extensión para que abra la misma ficha, realizar entrevistas/pilotos B2B.

**Fase 4 — escalar según evidencia:** ampliar ciudades donde los datos sean interpretables, comprobar conversión y retorno de usuarios, y solo entonces estudiar premium o aplicaciones nativas.

## Cambios de enfoque en el repositorio
- Conservar la ingestión, identidad de áreas, versiones de fronteras y controles de calidad.
- Replantear HomeGateway, las rutas de laboratorio, ciudad, área, búsqueda y comparación como **una sola navegación**, no otro skin ni páginas divergentes.
- Transformar extensión y widget en consumidores del mismo contrato; evitar duplicar interpretaciones de indicadores.
- Planificar migración de URLs antiguas con redirecciones y actualización de sitemap cuando el recorrido esté validado.
- No lanzar nuevas funciones de pago, notificaciones, expansión continental ni diseños cosméticos mientras el recorrido principal siga roto.

## Puertas de aceptación
1. Web y PWA: buscar un lugar sin conocer el nombre policial de su barrio, tocar un mapa legible, leer los datos y límites en una pantalla móvil, comparar, compartir.
2. Los valores, unidades, períodos, fuentes y advertencias coinciden en TODAS las superficies; los indicadores incomparables nunca se muestran como equivalentes.
3. Las direcciones ambiguas y zonas sin datos se explican sin fabricar resultados; todos los datos tienen procedencia y fecha comprobable.
4. Pruebas de teclado, móvil real y degradación ante mapas, búsqueda o datos caídos.
5. Métricas agregadas de búsqueda -> ficha válida -> comparación -> clic externo y retorno; pilotos comerciales medidos por interés real, no por estimaciones. Respetar privacidad y consentimiento.

**Prueba del producto integrado:** investigar un alojamiento por dirección en la web, abrir exactamente la misma ficha en móvil y desde la extensión, comparar su barrio y comprobar que información, fechas, cautelas y acciones son coherentes.
