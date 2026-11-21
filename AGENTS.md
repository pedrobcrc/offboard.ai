<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Outcome endpoints authorize the n8n header before loading the privileged client and bind inputs to service-role-only SQL helpers, preserving exact query semantics without exposing database execution to visitors.
- Serve external decision-log reads at `/api/public/decisions-read`; authorize the shared header before loading the service-role client, and use SELECT only so n8n cannot modify workspace data.
- Keep both procurement tabs in one dashboard at `/`; they are two views of one continuous workspace.
- Scope documents, tasks and decisions to an offboarding; Laura's case is the fixed-id sample offboarding, and the guided demo, suggested questions, cached answers and Reset demo apply only to it so other offboardings stay untouched.
- Build AI prompts from the active offboarding's data (departing person, remaining pool, tasks, documents); the assignee pool excludes departed members and the offboarding's own departing member, and completed offboardings are read-only in both server functions and database functions.
- Run retrieval and model calls inside server functions only; the browser reads documents through those functions and never talks to the model directly.
- Define application visual treatments in the global design system and use the shared Button for interactive actions.
- Keep Task Router presentation in its dedicated component; validate AI assignments before atomic database persistence so missing tasks or over-capacity allocations never partially save.
- Store buyer capacity as the baseline and derive projected workloads from persisted task criticality to avoid double-counting on refresh.
- Use the shared workload cap for prompts, validation and presentation; derive database-check migration limits from that constant and test parity so enforcement cannot drift.
- Persist AI proposals and manager decisions separately; reassignment stays proposed until approval, and review/reset operations update tasks and the audit log atomically in the shared demo workspace.
- Reset visitor uploads inside the atomic database reset using the upload detail marker, a seeded-filename exclusion and scoped DELETE policy; cascading foreign keys remove their search chunks while protecting seeded evidence.
- Validate model allocations with the shared pure validator and allow exactly one correction call for local validation errors before atomic persistence; gateway failures remain outside this retry to preserve terminal error handling.
- Keep answer-source filtering in a browser-safe presentation helper; retain all retrieved evidence on the server and fetch fresh workspace data into the query cache after manager decisions so review rows update immediately.
- Derive guided-demo step progress from workspace data via the pure helper in src/lib/demo-guide.ts; the guide adds UI only and reuses the existing reset function.
