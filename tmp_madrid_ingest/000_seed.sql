begin;

insert into public.countries(code,name) values ('ES','Spain')
on conflict(code) do update set name=excluded.name;

insert into public.cities(slug,country_code,name,timezone)
values ('madrid','ES','Madrid','Europe/Madrid')
on conflict(slug) do update set
  country_code=excluded.country_code,
  name=excluded.name,
  timezone=excluded.timezone;

insert into public.sources(
  slug,authority,source_url,licence,update_frequency,source_type,granularity,notes
) values (
  'madrid-police-dispatch-incidents',
  'Dirección General de la Policía Municipal de Madrid',
  'https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal',
  'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  'monthly',
  'municipal police central-dispatch incidents',
  'official municipal neighbourhood',
  'Operational incidents include citizen reports, patrol communications and alerts from other agencies; they are not equivalent to crime.'
)
on conflict(slug) do update set
  authority=excluded.authority,
  source_url=excluded.source_url,
  licence=excluded.licence,
  update_frequency=excluded.update_frequency,
  source_type=excluded.source_type,
  granularity=excluded.granularity,
  notes=excluded.notes;

insert into public.metrics(slug,label,family,description,higher_is_worse) values
('madrid-dispatch-accidente-de-trafico-con-heridos-victimas','ACCIDENTE DE TRAFICO CON HERIDOS-VICTIMAS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-accidente-de-trafico-sin-heridos','ACCIDENTE DE TRAFICO SIN HERIDOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-accidentes-laborales','ACCIDENTES LABORALES','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-actuacion-de-bomberos','ACTUACION DE BOMBEROS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-actuacion-de-samur-summa','ACTUACION DE SAMUR / SUMMA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-actuaciones-advas-en-locales-publicos-y-de-ocio','ACTUACIONES ADVAS. EN LOCALES PUBLICOS Y DE OCIO','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-alteraciones-de-trafico-y-movilidad','ALTERACIONES DE TRAFICO Y MOVILIDAD','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-amenazas-y-atentados-terroristas','AMENAZAS Y ATENTADOS TERRORISTAS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-anomalias-en-via-publica','ANOMALIAS EN VIA PUBLICA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-atentado-agresion-a-empleado-publico','ATENTADO - AGRESION A EMPLEADO PUBLICO','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-atropellos','ATROPELLOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-consumo-alcohol-drogas-en-via-publica','CONSUMO ALCOHOL/DROGAS EN VIA PUBLICA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-convivencia-colaboraciones-con-otros-servicios','CONVIVENCIA: COLABORACIONES CON OTROS SERVICIOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-delitos-contra-la-seguridad-vial','DELITOS CONTRA LA SEGURIDAD VIAL','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-delitos-contra-los-animales-y-medio-ambiente','DELITOS CONTRA LOS ANIMALES Y MEDIO AMBIENTE','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-fallecidos-por-delito-o-causa-desconocida','FALLECIDOS POR DELITO O CAUSA DESCONOCIDA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-grandes-sucesos','GRANDES SUCESOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-hurtos','HURTOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-incidencia-112','INCIDENCIA 112','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-informacion-al-ciudadano','INFORMACION AL CIUDADANO','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-informado-servicio-externo','INFORMADO SERVICIO EXTERNO','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-infraccion-a-otras-oomm-y-normas','INFRACCION A OTRAS OOMM Y NORMAS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-infracciones-al-trafico-y-seguridad-vial','INFRACCIONES AL TRAFICO Y SEGURIDAD VIAL','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-infracciones-ley-seguridad-ciudadana','INFRACCIONES LEY SEGURIDAD CIUDADANA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-llamada-erronea','LLAMADA ERRONEA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-manifestaciones-concentraciones','MANIFESTACIONES / CONCENTRACIONES','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-no-se-envia-recurso','NO SE ENVIA RECURSO','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-normas-de-convivencia','NORMAS DE CONVIVENCIA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-nota-informativa','NOTA INFORMATIVA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-otras-actuaciones','OTRAS ACTUACIONES','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-otros-delitos','OTROS DELITOS...','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-pruebas','PRUEBAS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-resolucion-conflictos-privados','RESOLUCION CONFLICTOS PRIVADOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-reyertas-agresiones','REYERTAS / AGRESIONES','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-robos-con-fuerza','ROBOS CON FUERZA','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-robos-con-violencia-intimidacion','ROBOS CON VIOLENCIA / INTIMIDACION','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-ruidos-molestos','RUIDOS MOLESTOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-seg-vial-colaboracion-en-materia-de-trafico-y-movilidad','SEG.VIAL: COLABORACION EN MATERIA DE TRAFICO Y MOVILIDAD','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-seguridad-colabracion-con-otros-cuerpos-o-servicios','SEGURIDAD: COLABRACION CON OTROS CUERPOS O SERVICIOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-servicio-especial-de-proteccion','SERVICIO ESPECIAL DE PROTECCION','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-servicios-especiales-diversos','SERVICIOS ESPECIALES DIVERSOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-simulacros','SIMULACROS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-sucesos-colaboraciones-con-otros-servicios','SUCESOS: COLABORACIONES CON OTROS SERVICIOS','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-sustraccion-de-vehiculo','SUSTRACCION DE VEHICULO','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-venta-ambulante','VENTA AMBULANTE','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null),
('madrid-dispatch-violencia-de-genero-y-familiar','VIOLENCIA DE GENERO Y FAMILIAR','municipal_police_dispatch','Incident handled by Madrid Municipal Police central dispatch; this source is broader than crime.',null)
on conflict(slug) do update set
  label=excluded.label,
  family=excluded.family,
  description=excluded.description,
  higher_is_worse=excluded.higher_is_worse;

commit;
