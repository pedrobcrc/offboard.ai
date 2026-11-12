# Offboard.AI — Procurement Continuity Engine

Offboard.AI is an MVP built for the IE University course "Artificial Intelligence for Decision Making" (Prof. Danilo Messinese). It helps a procurement team handle the departure of a Senior Buyer: a Knowledge Retriever makes the departing buyer's files searchable and answers questions with cited sources using retrieval-augmented generation, while a Task Router proposes who should take each open task based on expertise, workload and supplier criticality. AI proposes; a manager approves, reassigns with a required reason, or rejects, and every decision is logged.

**Live app:** https://offboard-ai.lovable.app

## How it works

- Retrieval uses full-text search over document chunks to find relevant evidence.
- Gemini 2.5 Flash via Lovable AI generates cited answers and task allocation proposals.
- Task allocations are validated against workload limits, with one automatic retry if validation fails.
- Manager review records decisions in a decision log and tracks the override rate.

## Demo data

A fictional case of Laura Martín, a departing Senior Buyer, with six seeded documents and seven open tasks; Reset demo restores this state.

## Team

Emma Minaudo, Phil Minvielle, Anna Muller, Maria Vittoria Munzone, Pedro Ribeiro da Cunha, Lily Winter.

## Built with Lovable

Built with [Lovable](https://lovable.dev). To run locally with Node.js and npm:

```sh
npm i
npm run dev
```
