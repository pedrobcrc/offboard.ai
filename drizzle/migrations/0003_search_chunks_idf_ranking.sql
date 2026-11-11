-- Rank retrieval by inverse document frequency of the matched question terms, so a
-- chunk containing a rare term ("deadline") beats one that only repeats a common one
-- ("days"). A plain ts_rank could not tell those apart and surfaced payment-terms
-- chunks for the deadline question.
create or replace function public.search_chunks(p_question text, p_limit integer default 4)
returns table (chunk_id bigint, document_id uuid, filename text, content text, score double precision)
language sql
stable
as $fn$
  with q as (
    select coalesce(nullif(btrim(plainto_tsquery('english', p_question)::text), ''), '') as txt
  ),
  terms as (
    select t from q, unnest(string_to_array(q.txt, ' & ')) as t where q.txt <> ''
  ),
  term_stats as (
    select t,
           (select count(*) from public.document_chunks dc where dc.search @@ to_tsquery('english', terms.t))::double precision as df
    from terms
  ),
  or_query as (
    select to_tsquery('english', coalesce(string_agg(t, ' | '), '""')) as tsq from terms
  ),
  scored as (
    select dc.id,
           sum(case when dc.search @@ to_tsquery('english', ts.t)
                    then 1.0 / (1.0 + ts.df) else 0 end) as idf_score,
           max(ts_rank(dc.search, oq.tsq)) as rank
    from public.document_chunks dc
    cross join term_stats ts
    cross join or_query oq
    group by dc.id, dc.search, oq.tsq
    having bool_or(dc.search @@ to_tsquery('english', ts.t))
  )
  select dc.id,
         d.id,
         d.filename,
         dc.content,
         (s.idf_score + 0.2 * s.rank)::double precision as score
  from scored s
  join public.document_chunks dc on dc.id = s.id
  join public.documents d on d.id = dc.document_id
  order by score desc, dc.id
  limit greatest(1, least(coalesce(p_limit, 4), 10));
$fn$;

grant execute on function public.search_chunks(text, integer) to anon, authenticated, service_role;