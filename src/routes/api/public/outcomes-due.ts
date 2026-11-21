import { createFileRoute } from "@tanstack/react-router";
import { handleOutcomesDue } from "@/lib/outcomes-due.server";

export const Route = createFileRoute("/api/public/outcomes-due")({
  server: {
    handlers: {
      POST: ({ request }) => handleOutcomesDue(request),
    },
  },
});