begin;

insert into public.countries(code,name) values ('GB','United Kingdom')
on conflict(code) do update set name=excluded.name;


insert into public.cities(slug,country_code,name,timezone)
values ('london','GB','London','Europe/London')
on conflict(slug) do update set country_code=excluded.country_code,name=excluded.name,timezone=excluded.timezone;


insert into public.sources(slug,authority,source_url,licence,update_frequency,source_type,granularity,notes)
values (
  'uk-police-open-data',
  'Single Online Home National Digital Team / UK Police',
  'https://data.police.uk/',
  'Open Government Licence v3.0',
  'monthly',
  'police-recorded street-level crime',
  'anonymised point locations and neighbourhood policing boundaries',
  'Locations are approximate; recorded crime is not equivalent to personal risk.'
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
('all-crime','All crime','recorded_crime','Police-recorded all crime incidents.',null),
('anti-social-behaviour','Anti-social behaviour','recorded_crime','Police-recorded anti-social behaviour incidents.',null),
('bicycle-theft','Bicycle theft','recorded_crime','Police-recorded bicycle theft incidents.',null),
('burglary','Burglary','recorded_crime','Police-recorded burglary incidents.',null),
('criminal-damage-arson','Criminal damage and arson','recorded_crime','Police-recorded criminal damage and arson incidents.',null),
('drugs','Drugs','recorded_crime','Police-recorded drugs incidents.',null),
('other-crime','Other crime','recorded_crime','Police-recorded other crime incidents.',null),
('other-theft','Other theft','recorded_crime','Police-recorded other theft incidents.',null),
('possession-of-weapons','Possession of weapons','recorded_crime','Police-recorded possession of weapons incidents.',null),
('public-order','Public order','recorded_crime','Police-recorded public order incidents.',null),
('robbery','Robbery','recorded_crime','Police-recorded robbery incidents.',null),
('shoplifting','Shoplifting','recorded_crime','Police-recorded shoplifting incidents.',null),
('theft-from-the-person','Theft from the person','recorded_crime','Police-recorded theft from the person incidents.',null),
('vehicle-crime','Vehicle crime','recorded_crime','Police-recorded vehicle crime incidents.',null),
('violent-crime','Violence and sexual offences','recorded_crime','Police-recorded violence and sexual offences incidents.',null)
on conflict(slug) do update set
  label=excluded.label,
  family=excluded.family,
  description=excluded.description,
  higher_is_worse=excluded.higher_is_worse;

commit;
