-- Retrieve on any meaningful question term (OR), ranked by ts_rank, instead of
-- requiring every question word to appear in one chunk. tsquery input syntax uses
-- "|" for OR, so the "&" from plainto_tsquery's text form is rewritten to "|".
create or replace function public.search_chunks(p_question text, p_limit integer default 4)
returns table (chunk_id bigint, document_id uuid, filename text, content text, score double precision)
language sql
stable
as $fn$
  with query as (
    select to_tsquery(
      'english',
      replace(
        coalesce(nullif(btrim(plainto_tsquery('english', p_question)::text), ''), '""'),
        ' & ',
        ' | '
      )
    ) as tsq
  )
  select dc.id,
         d.id,
         d.filename,
         dc.content,
         ts_rank(dc.search, query.tsq)::double precision as score
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  cross join query
  where dc.search @@ query.tsq
  order by score desc, dc.id
  limit greatest(1, least(coalesce(p_limit, 4), 10));
$fn$;

grant execute on function public.search_chunks(text, integer) to anon, authenticated, service_role;