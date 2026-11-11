-- Procurement continuity: real documents, chunks, full-text retrieval, team and tasks.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null unique,
  kind text not null,
  size_label text not null,
  detail text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  search tsvector not null
);

create index document_chunks_search_idx on public.document_chunks using gin (search);
create index document_chunks_document_idx on public.document_chunks (document_id);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  expertise text not null,
  workload text not null,
  capacity integer not null,
  tone text not null,
  position integer not null default 0
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'pending',
  assigned_buyer text,
  assigned_initials text,
  assigned_tone text,
  rationale text,
  position integer not null default 0,
  assigned_at timestamptz
);

create table public.workspace_info (
  id integer primary key default 1,
  departing_buyer_name text not null,
  departing_buyer_role text not null,
  departing_on date not null,
  constraint workspace_info_single_row check (id = 1)
);

-- Grants first: the Data API does not grant default privileges on public.
grant select on public.documents to anon;
grant select on public.document_chunks to anon;
grant insert on public.documents to anon;
grant all on public.documents to service_role;
grant all on public.document_chunks to service_role;
grant select on public.team_members to anon;
grant all on public.team_members to service_role;
grant select, update on public.tasks to anon;
grant all on public.tasks to service_role;
grant select on public.workspace_info to anon;
grant all on public.workspace_info to service_role;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.workspace_info enable row level security;

create policy "Anyone can read documents" on public.documents for select to anon, authenticated using (true);
create policy "Anyone can index documents" on public.documents for insert to anon, authenticated with check (true);
create policy "Anyone can read document chunks" on public.document_chunks for select to anon, authenticated using (true);
create policy "Anyone can read team members" on public.team_members for select to anon, authenticated using (true);
create policy "Anyone can read tasks" on public.tasks for select to anon, authenticated using (true);
create policy "Anyone can assign tasks" on public.tasks for update to anon, authenticated using (true) with check (true);
create policy "Anyone can read workspace info" on public.workspace_info for select to anon, authenticated using (true);

-- Split document text into chunks of about p_target characters, on whitespace boundaries.
create or replace function public.chunk_document_text(p_content text, p_target integer default 500)
returns table (chunk_index integer, content text)
language plpgsql
immutable
as $fn$
declare
  v_text text := btrim(regexp_replace(coalesce(p_content, ''), '\r', '', 'g'));
  v_len integer := char_length(v_text);
  v_pos integer := 1;
  v_window text;
  v_trimmed text;
  v_step integer;
  v_idx integer := 0;
begin
  if v_len = 0 then
    return;
  end if;
  loop
    v_window := substring(v_text from v_pos for p_target);
    if v_pos + p_target - 1 >= v_len then
      v_trimmed := v_window;
    else
      v_trimmed := regexp_replace(v_window, '\s*\S*$', '');
      if char_length(btrim(v_trimmed)) = 0 then
        v_trimmed := v_window;
      end if;
    end if;
    v_step := char_length(v_trimmed);
    if v_step = 0 then
      v_step := p_target;
    end if;
    if char_length(btrim(v_trimmed)) > 0 then
      chunk_index := v_idx;
      content := btrim(v_trimmed);
      v_idx := v_idx + 1;
      return next;
    end if;
    v_pos := v_pos + v_step;
    exit when v_pos > v_len;
  end loop;
end;
$fn$;

-- (Re)build the chunks of one document.
create or replace function public.index_document(p_document_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  delete from public.document_chunks where document_id = p_document_id;
  insert into public.document_chunks (document_id, chunk_index, content, search)
  select p_document_id, c.chunk_index, c.content, to_tsvector('english', c.content)
  from public.chunk_document_text((select content from public.documents where id = p_document_id)) as c;
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- Top chunks for a question using Postgres full-text search.
create or replace function public.search_chunks(p_question text, p_limit integer default 4)
returns table (chunk_id bigint, document_id uuid, filename text, content text, score double precision)
language sql
stable
as $fn$
  select dc.id,
         d.id,
         d.filename,
         dc.content,
         ts_rank(dc.search, websearch_to_tsquery('english', p_question))::double precision as score
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where dc.search @@ websearch_to_tsquery('english', p_question)
  order by score desc, dc.id
  limit greatest(1, least(coalesce(p_limit, 4), 10));
$fn$;

grant execute on function public.chunk_document_text(text, integer) to anon, authenticated, service_role;
grant execute on function public.index_document(uuid) to anon, authenticated, service_role;
grant execute on function public.search_chunks(text, integer) to anon, authenticated, service_role;

-- Seed: departing buyer.
insert into public.workspace_info (id, departing_buyer_name, departing_buyer_role, departing_on)
values (1, 'Laura Martín', 'Senior Buyer', date '2026-11-25');

-- Seed: team capacity.
insert into public.team_members (name, initials, expertise, workload, capacity, tone, position) values
  ('Sarah', 'SJ', 'Packaging expert', 'Low', 24, 'green', 1),
  ('Mike', 'MT', 'Plastics expert', 'High', 86, 'amber', 2),
  ('David', 'DC', 'Logistics expert', 'Medium', 52, 'blue', 3);

-- Seed: departing buyer pending tasks.
insert into public.tasks (title, status, position) values
  ('Renegotiate Q3 plastics rate', 'pending', 1),
  ('Finalize AMCOR paper renewal', 'pending', 2),
  ('Resolve shipping delay with Logistics Corp', 'pending', 3);

-- Seed: documents (plain text, realistic content).
insert into public.documents (filename, kind, size_label, detail, content) values
('AMCOR_Paper_Supplier_Contract.pdf', 'PDF', '2.4 MB', 'Supplier contract',
'AMCOR PAPER PACKAGING SUPPLY CONTRACT
Contract number: AM-2024-118. Supplier: AMCOR Packaging Solutions. Customer: our procurement organisation. Effective 16 December 2024.

1. Products and scope
AMCOR supplies coated paperboard, corrugated cartons and printed packaging sleeves for the food and consumer goods lines. All grades must meet our approved packaging specification and food-contact requirements.

2. Volume discount
A 15% volume discount applies to all orders over 10,000 units. The discount is calculated per SKU, per calendar month, against the published list price and appears as a separate line on the monthly invoice. It is not combined with the annual rebate programme.

3. Renewal deadline
This agreement expires on 15 December 2026 and must be renewed by that date. Written notice of intent to renegotiate or exit is required at least 60 days before 15 December 2026.

4. Account management
The primary AMCOR account manager is Tom Becker. Tom handles pricing requests, allocation disputes and escalations. Secondary contact: customer service desk, reachable through Tom Becker.

5. Payment and price adjustment
Payment terms are 45 days from invoice date. List prices are adjusted quarterly against the published European paper index; AMCOR must give 30 days written notice of any adjustment.

6. Delivery and quality
Delivery is FOB our receiving facility. AMCOR carries transport risk until goods are signed for. Quality acceptance is AQL 2.5; rejected lots must be replaced within ten working days.

7. Termination and exclusivity
Either party may terminate on 90 days written notice for convenience, or immediately for repeated quality failure. The agreement is non-exclusive: alternative packaging suppliers may be qualified at any time.'),
('Email_Log_PlasticsCorp.eml', 'EML', '846 KB', 'Email correspondence',
'From: Markus Keller, Account Manager, PlasticsCorp <markus.keller@plasticcorp.example>
To: Laura Martin, Senior Buyer
Subject: 2027 resin pricing and open quality items
Date: 2026-10-08

Hi Laura,

Following our last call I want to put the two open items in writing before the year-end review.

First, pricing. PlasticsCorp proposes an 8% resin price increase from 1 January 2027. The increase covers the crude-based feedstock movement we have absorbed since March and the energy surcharge on the Ludwigshafen line. The new price list would apply to all grades we currently supply: HDPE blow-moulding, PP copolymer and the food-grade film resin. We would need written acceptance by 15 December 2026 so the change can be loaded into your contract account.

Second, quality. The dispute on lot #4471 is still unresolved. That lot shows a 12% defect rate on the incoming inspection, mainly surface contamination and off-spec colour. Your quality team quarantined the remaining stock and returned eight reels. Our corrective action report is with our plant team; we have not yet issued a credit note. I understand the claim is open and I am asking for a credit against the November invoice.

Could you confirm the volume forecast for 2027 as well? We need it to reserve extrusion capacity in Q1.

Best regards,
Markus Keller
PlasticsCorp
--
From: Laura Martin
To: Markus Keller
Date: 2026-10-12
Markus, we cannot accept an 8% increase while lot #4471 is open. I will raise both in the year-end review. Please send the corrective action report and a proposed credit figure.'),
('Laura_Personal_Notes.docx', 'DOCX', '38 KB', 'Informal notes from the departing buyer',
'Personal notes - Laura Martin, Senior Buyer
Not a contract. Things I carry in my head that never made it into a file.

PlasticsCorp cap
At the K-Fair trade show in Dusseldorf I shook hands with Markus on a cap: any 2027 resin increase is capped at 4%, whatever the price list says. This verbal agreement was never formalised - no email, no amendment, no signature. If they push the 8% from the October email, the K-Fair handshake is the only thing that says 4%. I need someone to put it in writing before they load a new price list.

NordSteel
NordSteel is our only qualified steel supplier. Nobody else has passed qualification, so there is no fallback this year. NordSteel needs the 2027 volume forecast by 5 Dec 2026 to hold allocation and pricing. If the forecast is late we lose the slot and have to re-qualify a second mill, which is a four-month job.

ChemSol and Ana
Ana handled ChemSol well when I was on leave in 2025. She kept the solvent deliveries on schedule and the supplier stayed calm. She is the natural owner for ChemSol if I am not here.

My open reminders
1. ChemSol price protection expires 30 Nov 2026 - nobody has started the renewal.
2. NordSteel 2027 volume forecast due 5 Dec 2026.
3. AMCOR contract renewal deadline 15 Dec 2026.
4. PlasticsCorp lot #4471 quality dispute still open, 12% defect rate.
5. PlasticsCorp proposes 8% resin increase from 1 Jan 2027; my K-Fair cap was 4%.

Before I go: brief Ana on ChemSol, and get the K-Fair resin cap in writing from PlasticsCorp.'),
('LogisticsCorp_Service_Agreement.pdf', 'PDF', '1.6 MB', 'Freight and warehousing agreement',
'LOGISTICSCORP SERVICE AGREEMENT
Agreement number: LC-2025-07. Supplier: Logistics Corp. Customer: our procurement organisation. Effective 3 February 2025.

1. Services
Logistics Corp provides multimodal freight, customs handling and short-term warehousing for inbound procurement shipments.

2. Delay penalty
A penalty of 2% of the affected shipment value applies per week of delay beyond the agreed transit time. Partial weeks are counted as full weeks. The penalty is capped at 10% of the shipment value.

3. Current shipment
Shipment LC-88214 is currently delayed by three weeks against the agreed transit time. Under clause 2 this represents 6% of the shipment value in delay penalties.

4. Claim window
Any claim for delay penalties must be filed within 30 days of the delivery date. A claim filed after the 30-day window is time-barred and Logistics Corp is entitled to reject it.

5. Operating terms
Fuel surcharges are adjusted quarterly. Demurrage is billed at the published tariff after three free days. Logistics Corp must provide tracking updates every 48 hours.

6. Liability and insurance
Logistics Corp liability is limited to the declared shipment value unless the loss results from gross negligence. Cargo insurance is placed with our broker.

7. Termination
Either party may terminate on 60 days written notice. Performance review meetings are held each quarter.'),
('ChemSol_Contract.pdf', 'PDF', '1.1 MB', 'Solvent supply contract',
'CHEMSOL SUPPLY CONTRACT
Contract number: CS-2024-42. Supplier: ChemSol GmbH. Customer: our procurement organisation. Effective 1 July 2024.

1. Products
ChemSol supplies industrial solvents and cleaning agents for the coatings and packaging lines: IPA, acetone, ethyl acetate and a blended degreaser.

2. Price protection clause
Prices are fixed under the price protection clause until 30 November 2026. After that date ChemSol may revise unit prices on 30 days written notice. The price protection clause expires 30 Nov 2026.

3. Renewal status
The renewal has not been started. No draft has been circulated, no renewal meeting is scheduled, and no forecast has been sent to ChemSol.

4. Lead times and delivery
Standard lead time is four weeks. Monthly deliveries are scheduled on the 1st. Emergency orders carry a 12% surcharge.

5. Quality and compliance
Quality acceptance is AQL 2.0 with a certificate of analysis per batch. ChemSol must supply REACH and safety data documentation with every delivery. Defect claims must be raised within 15 days.

6. Storage and safety
ChemSol handles hazardous goods transport under ADR rules. Our site must maintain the agreed minimum stock of four weeks coverage.

7. Termination
Either party may terminate on 90 days written notice. ChemSol holds first refusal on new solvent requirements before a second supplier is qualified.'),
('Q3_Vendor_Spend.xlsx', 'XLSX', '1.2 MB', 'Spend analysis',
'Q3 VENDOR SPEND REPORT
Reporting period: Q3 2026. Currency: EUR. Prepared by: Procurement Analytics.

Spend by supplier
PlasticsCorp - 1,800,000 - plastics and resin - 34% of Q3 spend
NordSteel - 1,400,000 - steel - 27% of Q3 spend
AMCOR - 900,000 - paper packaging - 17% of Q3 spend
ChemSol - 600,000 - solvents - 11% of Q3 spend
Logistics Corp - 450,000 - freight and warehousing - 9% of Q3 spend
GreenLabel - 120,000 - certification and labels - 2% of Q3 spend
Total Q3 spend: 5,270,000 EUR.

Notes
PlasticsCorp is our largest supplier by value and the increase they propose in the October email would add roughly 144,000 EUR a year at Q3 volumes. NordSteel is the second largest and the only qualified steel mill. AMCOR paper packaging spend sits below both. ChemSol solvent spend is stable across the quarter. Logistics Corp freight spend includes the delayed shipment LC-88214. GreenLabel covers certification and label printing.

Payment terms by supplier
PlasticsCorp 30 days, NordSteel 45 days, AMCOR 45 days, ChemSol 30 days, Logistics Corp 21 days, GreenLabel 14 days.

Invoice counts
PlasticsCorp 41, NordSteel 28, AMCOR 33, ChemSol 17, Logistics Corp 62, GreenLabel 6.

Year to date
Q1 4,910,000 EUR, Q2 5,050,000 EUR, Q3 5,270,000 EUR. Spend is trending up about 4% a quarter, led by resin and steel volumes.');

-- Build the searchable chunks for the seeded documents.
insert into public.document_chunks (document_id, chunk_index, content, search)
select d.id, c.chunk_index, c.content, to_tsvector('english', c.content)
from public.documents d
cross join lateral public.chunk_document_text(d.content, 500) as c
order by d.created_at, c.chunk_index;
