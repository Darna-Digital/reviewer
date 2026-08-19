/**
 * The one thing this view cannot do with a pull request: leave it. Everything
 * else about one — its diff, its comments, the branch it lands on — is already
 * here, so the way out is a quiet control riding beside the trail that names
 * the pull request, rather than a place the view hands you off to.
 *
 * A link, not a button that navigates: the desktop shell sends `_blank` to the
 * system browser and the web build opens a tab, so both do the right thing
 * without either being asked. The mark is a stroke glyph in `currentColor`,
 * which is what keeps it legible on both themes — GitHub's own filled logo is
 * black, and black on a dark header is a hole.
 */
import { IconBrandGithub } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export function OpenInGitHub({ url }: { url: string }) {
  return (
    <Button
      variant="ghost-muted"
      size="xs"
      render={<a href={url} target="_blank" rel="noreferrer" />}
    >
      <IconBrandGithub />
      Open in GitHub
    </Button>
  );
}
