-- Example data: Laura Martín's sample offboarding (fictional case).
INSERT INTO public.workspace_info (id, departing_buyer_name, departing_buyer_role, departing_on) VALUES (1, 'Laura Martín', 'Senior Buyer', '2026-11-25') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.offboardings (id, departing_name, departing_role, last_working_day, status, is_sample, created_at) VALUES ('00000000-0000-4000-8000-0000000000a1', 'Laura Martín', 'Senior Buyer', '2026-11-25', 'in_review', true, '2026-01-01') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_members (id, name, initials, expertise, workload, capacity, tone, position) VALUES ('6a96a289-c0eb-4054-b4a1-495b282f32bb', 'Sarah', 'S', 'Packaging expert', '55%', 55, 'green', 0);
INSERT INTO public.team_members (id, name, initials, expertise, workload, capacity, tone, position) VALUES ('e3056771-eea8-4a3d-a035-7041366eb38d', 'Mike', 'M', 'Plastics expert', '90%', 90, 'amber', 1);
INSERT INTO public.team_members (id, name, initials, expertise, workload, capacity, tone, position) VALUES ('53973189-98d5-488c-8d29-5b1282021b34', 'David', 'D', 'Logistics expert', '70%', 70, 'blue', 2);
INSERT INTO public.team_members (id, name, initials, expertise, workload, capacity, tone, position) VALUES ('af747883-e0d0-4d43-b1b9-d019149de38c', 'Ana', 'A', 'Junior buyer (2 years), generalist', '40%', 40, 'green', 3);
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('d3ac21d8-5ad2-47e8-8431-1c0309598b04', 'Renegotiate PlasticsCorp 2027 resin price', 'pending', 0, 'PlasticsCorp', '2026-11-25', 'High', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('97ca1e76-e4a3-47ff-86e2-665eee596fec', 'Resolve PlasticsCorp quality dispute, lot #4471', 'pending', 1, 'PlasticsCorp', '2026-11-30', 'High', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('7d9c1de2-279b-49ab-a6dc-aad708c41fce', 'Finalize AMCOR paper renewal', 'pending', 2, 'AMCOR', '2026-12-15', 'Medium', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('2a5db37d-9241-488b-a4b5-9eabd6e683e1', 'File Logistics Corp delay penalty claim', 'pending', 3, 'Logistics Corp', '2026-12-04', 'Medium', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('3d7702b6-2e45-4f4e-8528-28da68b79c63', 'Send NordSteel 2027 volume forecast — sole-source supplier', 'pending', 4, 'NordSteel', '2026-12-05', 'High', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('c1a27ead-f526-4bdd-b676-33a03a7af7fb', 'Renew ChemSol before price protection expires', 'pending', 5, 'ChemSol', '2026-11-30', 'High', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.tasks (id, title, status, position, supplier, due_date, criticality, offboarding_id) VALUES ('0290aa64-2710-4ab2-8b4e-69b266933aee', 'Issue GreenLabel quarterly PO', 'pending', 6, 'GreenLabel', '2026-12-20', 'Low', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.documents (filename, kind, size_label, detail, content, created_at, offboarding_id) VALUES ('AMCOR_Paper_Supplier_Contract.pdf', 'PDF', '2.4 MB', 'Supplier contract', 'AMCOR PAPER PACKAGING SUPPLY CONTRACT
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
Either party may terminate on 90 days written notice for convenience, or immediately for repeated quality failure. The agreement is non-exclusive: alternative packaging suppliers may be qualified at any time.', '2026-11-11T16:57:53.395882+00:00', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.documents (filename, kind, size_label, detail, content, created_at, offboarding_id) VALUES ('Email_Log_PlasticsCorp.eml', 'EML', '846 KB', 'Email correspondence', 'From: Markus Keller, Account Manager, PlasticsCorp <markus.keller@plasticcorp.example>
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
Markus, we cannot accept an 8% increase while lot #4471 is open. I will raise both in the year-end review. Please send the corrective action report and a proposed credit figure.', '2026-11-11T16:57:53.395882+00:00', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.documents (filename, kind, size_label, detail, content, created_at, offboarding_id) VALUES ('Laura_Personal_Notes.docx', 'DOCX', '38 KB', 'Informal notes from the departing buyer', 'Personal notes - Laura Martin, Senior Buyer
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

Before I go: brief Ana on ChemSol, and get the K-Fair resin cap in writing from PlasticsCorp.', '2026-11-11T16:57:53.395882+00:00', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.documents (filename, kind, size_label, detail, content, created_at, offboarding_id) VALUES ('LogisticsCorp_Service_Agreement.pdf', 'PDF', '1.6 MB', 'Freight and warehousing agreement', 'LOGISTICSCORP SERVICE AGREEMENT
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
Either party may terminate on 60 days written notice. Performance review meetings are held each quarter.', '2026-11-11T16:57:53.395882+00:00', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.documents (filename, kind, size_label, detail, content, created_at, offboarding_id) VALUES ('ChemSol_Contract.pdf', 'PDF', '1.1 MB', 'Solvent supply contract', 'CHEMSOL SUPPLY CONTRACT
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
Either party may terminate on 90 days written notice. ChemSol holds first refusal on new solvent requirements before a second supplier is qualified.', '2026-11-11T16:57:53.395882+00:00', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.documents (filename, kind, size_label, detail, content, created_at, offboarding_id) VALUES ('Q3_Vendor_Spend.xlsx', 'XLSX', '1.2 MB', 'Spend analysis', 'Q3 VENDOR SPEND REPORT
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
Q1 4,910,000 EUR, Q2 5,050,000 EUR, Q3 5,270,000 EUR. Spend is trending up about 4% a quarter, led by resin and steel volumes.', '2026-11-11T16:57:53.395882+00:00', '00000000-0000-4000-8000-0000000000a1');
SELECT public.index_document(id) FROM public.documents;
