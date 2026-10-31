-- Normaliza texto para búsquedas: minúsculas y sin tildes (sin depender de la extensión unaccent).
CREATE OR REPLACE FUNCTION unaccent_lower(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(coalesce(input, ''), 'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñ', 'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'))
$$;
