import { createFileRoute } from "@tanstack/react-router";
import { CloudRunView } from "@/interactions/cloud/components/cloud-run-view";
import { cloudRunQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_app/modes/agent-session/cloud/$runId")({
  // Warms the snapshot the live view seeds itself from — not awaited, for the
  // same reason the local session route does not wait on its conversation.
  loader: ({ context, params }) => {
    void context.queryClient
      .ensureQueryData(cloudRunQueryOptions(params.runId))
      .catch(() => null);
  },
  component: CloudRunRoute,
});

function CloudRunRoute() {
  const { runId } = Route.useParams();
  // Keyed so switching runs resets the stream and composer state cleanly.
  return <CloudRunView key={runId} runId={runId} />;
}
