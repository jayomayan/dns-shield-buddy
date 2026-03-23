CREATE OR REPLACE FUNCTION public.exec_migration_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;