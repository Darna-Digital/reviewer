/**
 * The cloud setting: where the app is connected, who as, and the way in.
 *
 * Connecting is the OAuth device flow, which is three states of one row.
 * Disconnected shows the server and a Connect button; pending shows the code
 * the person types into the browser, opens that browser for them, and polls
 * until the cloud says yes, no, or too late; connected names the account and
 * offers the way out. The polling survives leaving the page — the server
 * holds the pending flow, so coming back to a row still pending picks it up.
 */
import {
  IconCloud,
  IconCloudCheck,
  IconCloudOff,
  IconExternalLink,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_CLOUD_SERVER_URL } from "@byconvo/core/cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingRow } from "@/interactions/settings/components/setting-row";
import { useCloudStatus } from "@/lib/queries";
import { useCloudActions } from "../adapters/cloud.hook.adapter";
import { cloudAppHref } from "../functions/cloud-review.functions";

export function CloudSetting() {
  const status = useCloudStatus();
  const actions = useCloudActions();
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connection = status.data ?? null;
  const typed = serverUrl ?? connection?.serverUrl ?? DEFAULT_CLOUD_SERVER_URL;

  const connect = async () => {
    setBusy(true);
    try {
      const pending = await actions.connect(typed);
      const url = pending.pending?.verificationUriComplete;
      if (url !== undefined) window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not reach byconvo cloud"
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Signing in to Codex here rather than in the cloud: its login redirects to
   * a port on localhost, which only exists on this machine. The cloud is left
   * asking for a device code; from here it is a click and an approval.
   */
  const [agentNote, setAgentNote] = useState<string | null>(null);
  const connectCodex = async () => {
    setBusy(true);
    setAgentNote(null);
    try {
      const connected = await actions.connectAgent("codex");
      setAgentNote(
        connected.kind === "reused"
          ? "Codex was already signed in here — sent to byconvo cloud."
          : "Codex connected. byconvo cloud runs it on your subscription."
      );
    } catch (error) {
      setAgentNote(
        error instanceof Error ? error.message : "failed to connect Codex"
      );
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await actions.disconnect();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "failed to disconnect"
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Poll for as long as the row is pending and mounted. Keyed on the code
   * rather than the status so a fresh Connect after a lapse starts a fresh
   * loop, and the old one — aborted on the way out — never answers for it.
   */
  const awaitApproval = useRef(actions.awaitApproval);
  awaitApproval.current = actions.awaitApproval;
  const userCode = connection?.pending?.userCode ?? null;
  useEffect(() => {
    if (connection === null || connection.status !== "pending") return;
    const controller = new AbortController();
    void awaitApproval.current(connection, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      switch (result.kind) {
        case "connected":
          toast.success(
            `Connected to byconvo cloud as ${result.connection.user?.name ?? "you"}`
          );
          return;
        case "expired":
          toast("The code expired before it was approved — connect again.");
          return;
        case "denied":
          toast.error("byconvo cloud refused the connection.");
          return;
        case "cancelled":
          return;
      }
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCode]);

  if (connection === null) {
    return (
      <SettingRow
        title="byconvo cloud"
        detail={
          status.isPending
            ? "Checking the connection…"
            : "Could not check the connection to byconvo cloud"
        }
      >
        <IconCloud className="size-4 text-muted-foreground" />
      </SettingRow>
    );
  }

  if (connection.status === "connected") {
    const user = connection.user;
    return (
      <SettingRow
        title="byconvo cloud"
        detail={
          user === null
            ? `Connected to ${connection.serverUrl}`
            : `${user.name} · ${user.email} · ${user.plan} plan · ${connection.serverUrl}`
        }
      >
        <IconCloudCheck className="size-4 text-brand-500" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(
              cloudAppHref(connection.serverUrl, "/app/repos"),
              "_blank",
              "noopener"
            )
          }
        >
          Repositories
          <IconExternalLink className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void connectCodex()}
          title="Sign in to Codex here and use it in byconvo cloud"
        >
          Connect Codex
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void disconnect()}
        >
          Disconnect
        </Button>
        {agentNote !== null && (
          <span className="text-xs text-muted-foreground">{agentNote}</span>
        )}
      </SettingRow>
    );
  }

  if (connection.status === "pending" && connection.pending !== null) {
    const pending = connection.pending;
    return (
      <SettingRow
        title="byconvo cloud"
        detail={`Enter this code at ${pending.verificationUri} to approve this machine. Waiting for approval…`}
      >
        <span
          className="rounded-md border bg-elevate px-2.5 py-1 font-mono text-sm tracking-widest select-all"
          aria-label="Device code"
        >
          {pending.userCode}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            window.open(pending.verificationUriComplete, "_blank", "noopener")
          }
        >
          <IconExternalLink className="size-4" />
          Open browser
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void disconnect()}
        >
          Cancel
        </Button>
      </SettingRow>
    );
  }

  return (
    <SettingRow
      title="byconvo cloud"
      detail="Run agent sessions in the cloud and follow them from here. Disconnected."
    >
      <IconCloudOff className="size-4 text-muted-foreground" />
      <Input
        value={typed}
        onChange={(event) => setServerUrl(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void connect();
        }}
        placeholder={DEFAULT_CLOUD_SERVER_URL}
        aria-label="Cloud server URL"
        className="w-64"
        spellCheck={false}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy || typed.trim().length === 0}
        onClick={() => void connect()}
      >
        Connect
      </Button>
    </SettingRow>
  );
}
