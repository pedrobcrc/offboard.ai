import { createFileRoute } from "@tanstack/react-router";
import { handleDecisionsRead } from "@/lib/decisions-read.server";

export const Route = createFileRoute("/api/public/decisions-read")({
  server: {
    handlers: {
      GET: ({ request }) => handleDecisionsRead(request),
      POST: ({ request }) => handleDecisionsRead(request),
    },
  },
});