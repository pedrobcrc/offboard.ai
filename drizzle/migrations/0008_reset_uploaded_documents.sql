GRANT DELETE ON public.documents TO anon, authenticated;
CREATE POLICY "Reset can remove visitor uploads only" ON public.documents FOR DELETE TO anon, authenticated USING (
 detail = 'Uploaded document' AND filename NOT IN ('AMCOR_Paper_Supplier_Contract.pdf','Email_Log_PlasticsCorp.eml','Laura_Personal_Notes.docx','LogisticsCorp_Service_Agreement.pdf','ChemSol_Contract.pdf','Q3_Vendor_Spend.xlsx')
);
CREATE OR REPLACE FUNCTION public.reset_task_demo() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 PERFORM id FROM public.tasks ORDER BY id FOR UPDATE;
 UPDATE public.tasks SET status='pending',assigned_buyer=null,assigned_initials=null,assigned_tone=null,assigned_member_id=null,rationale=null,confidence=null,source_file=null,assigned_at=null,ai_proposed_buyer=null,proposal_id=null,overridden=false WHERE id IS NOT NULL;
 DELETE FROM public.task_decisions WHERE id IS NOT NULL;
 DELETE FROM public.documents WHERE detail = 'Uploaded document' AND filename NOT IN ('AMCOR_Paper_Supplier_Contract.pdf','Email_Log_PlasticsCorp.eml','Laura_Personal_Notes.docx','LogisticsCorp_Service_Agreement.pdf','ChemSol_Contract.pdf','Q3_Vendor_Spend.xlsx');
END; $$;
GRANT EXECUTE ON FUNCTION public.reset_task_demo() TO anon,authenticated,service_role;