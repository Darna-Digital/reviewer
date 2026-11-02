import { useNavigate } from "@tanstack/react-router";

const BROWSE_ROUTE = "/modes/code/browse";

/** Opens a file in the browser; `repo` moves the page to another root first. */
export const useOpenBrowseTab = () => {
  const navigate = useNavigate();
  return (file: string, line?: number, repo?: string) =>
    void navigate({
      to: BROWSE_ROUTE,
      search: {
        file,
        line,
        tab: "permanent",
        ...(repo === undefined ? {} : { repo }),
      },
    });
};
