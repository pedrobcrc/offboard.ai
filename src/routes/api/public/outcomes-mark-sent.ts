import { createFileRoute } from "@tanstack/react-router";
import { handleOutcomesMarkSent } from "@/lib/outcomes-mark-sent.server";

export const Route = createFileRoute("/api/public/outcomes-mark-sent")({
  server: {
    handlers: {
      POST: ({ request }) => handleOutcomesMarkSent(request),
    },
  },
});