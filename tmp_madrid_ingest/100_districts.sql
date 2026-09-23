begin;
insert into public.areas(id,city_slug,source_slug,source_area_id,parent_area_id,area_type,slug,name,population,active) values
('es-madrid-district:01','madrid','madrid-police-dispatch-incidents','district:01',null,'municipal_district','centro','Centro',null,true),
('es-madrid-district:02','madrid','madrid-police-dispatch-incidents','district:02',null,'municipal_district','arganzuela','Arganzuela',null,true),
('es-madrid-district:03','madrid','madrid-police-dispatch-incidents','district:03',null,'municipal_district','retiro','Retiro',null,true),
('es-madrid-district:04','madrid','madrid-police-dispatch-incidents','district:04',null,'municipal_district','salamanca','Salamanca',null,true),
('es-madrid-district:05','madrid','madrid-police-dispatch-incidents','district:05',null,'municipal_district','chamartin','Chamartín',null,true),
('es-madrid-district:06','madrid','madrid-police-dispatch-incidents','district:06',null,'municipal_district','tetuan','Tetuán',null,true),
('es-madrid-district:07','madrid','madrid-police-dispatch-incidents','district:07',null,'municipal_district','chamberi','Chamberí',null,true),
('es-madrid-district:08','madrid','madrid-police-dispatch-incidents','district:08',null,'municipal_district','fuencarral-el-pardo','Fuencarral - El Pardo',null,true),
('es-madrid-district:09','madrid','madrid-police-dispatch-incidents','district:09',null,'municipal_district','moncloa-aravaca','Moncloa - Aravaca',null,true),
('es-madrid-district:10','madrid','madrid-police-dispatch-incidents','district:10',null,'municipal_district','latina','Latina',null,true),
('es-madrid-district:11','madrid','madrid-police-dispatch-incidents','district:11',null,'municipal_district','carabanchel','Carabanchel',null,true),
('es-madrid-district:12','madrid','madrid-police-dispatch-incidents','district:12',null,'municipal_district','usera','Usera',null,true),
('es-madrid-district:13','madrid','madrid-police-dispatch-incidents','district:13',null,'municipal_district','puente-de-vallecas','Puente de Vallecas',null,true),
('es-madrid-district:14','madrid','madrid-police-dispatch-incidents','district:14',null,'municipal_district','moratalaz','Moratalaz',null,true),
('es-madrid-district:15','madrid','madrid-police-dispatch-incidents','district:15',null,'municipal_district','ciudad-lineal','Ciudad Lineal',null,true),
('es-madrid-district:16','madrid','madrid-police-dispatch-incidents','district:16',null,'municipal_district','hortaleza','Hortaleza',null,true),
('es-madrid-district:17','madrid','madrid-police-dispatch-incidents','district:17',null,'municipal_district','villaverde','Villaverde',null,true),
('es-madrid-district:18','madrid','madrid-police-dispatch-incidents','district:18',null,'municipal_district','villa-de-vallecas','Villa de Vallecas',null,true),
('es-madrid-district:19','madrid','madrid-police-dispatch-incidents','district:19',null,'municipal_district','vicalvaro','Vicálvaro',null,true),
('es-madrid-district:20','madrid','madrid-police-dispatch-incidents','district:20',null,'municipal_district','san-blas-canillejas','San Blas - Canillejas',null,true),
('es-madrid-district:21','madrid','madrid-police-dispatch-incidents','district:21',null,'municipal_district','barajas','Barajas',null,true)
    on conflict(id) do update set
      city_slug=excluded.city_slug,
      source_slug=excluded.source_slug,
      source_area_id=excluded.source_area_id,
      parent_area_id=excluded.parent_area_id,
      area_type=excluded.area_type,
      slug=excluded.slug,
      name=excluded.name,
      population=excluded.population,
      active=excluded.active;
    
commit;
