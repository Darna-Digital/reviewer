/**
 * What reviewer can read, and what it cannot.
 *
 * Go to definition, find usages, hover and the problems bar all come from a
 * language provider, and until now a repository whose provider could not run
 * said so nowhere: the file simply had no definitions in it, which looks
 * exactly like a feature that does not work. The providers endpoint has always
 * carried the reason — a missing binary, a malformed `.reviewer/languages.json`
 * entry — and this is where it is finally read out.
 *
 * Availability is per project, not per file: a provider counts as available
 * when any of the project's repositories can run it.
 */
import { IconLanguage } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { SettingRow } from "@/interactions/settings/components/setting-row";
import { useLanguageProviders } from "../adapters/language.hook.adapter";

export function LanguagesSetting() {
  const providers = useLanguageProviders();
  const listed = providers.data ?? [];

  return (
    <>
      <SettingRow
        title="Languages"
        detail="Definitions, usages, hover and problems come from a language server. A repository adds one in .reviewer/languages.json; TypeScript and Ruby are built in."
      >
        <IconLanguage className="size-4 text-muted-foreground" />
      </SettingRow>
      {providers.isError && (
        <SettingRow
          title="No repository open"
          detail="Open a project to see what it can be read with."
        >
          <Badge variant="outline">—</Badge>
        </SettingRow>
      )}
      {listed.map((provider) => (
        <SettingRow
          key={provider.id}
          title={provider.name}
          // The detail is the whole point of the row: where the server was
          // found, or why it was not.
          detail={
            provider.detail.length > 0
              ? `${provider.patterns.join(" ")} · ${provider.detail}`
              : provider.patterns.join(" ")
          }
        >
          <Badge variant={provider.available ? "secondary" : "destructive"}>
            {provider.available ? "Ready" : "Not found"}
          </Badge>
        </SettingRow>
      ))}
    </>
  );
}
