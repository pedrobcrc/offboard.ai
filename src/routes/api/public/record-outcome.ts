import { createFileRoute } from "@tanstack/react-router";
import { handleRecordOutcome } from "@/lib/record-outcome.server";

export const Route = createFileRoute("/api/public/record-outcome")({
  server: {
    handlers: {
      POST: ({ request }) => handleRecordOutcome(request),
    },
  },
});