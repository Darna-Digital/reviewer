import { useNavigate } from "@tanstack/react-router";

const BROWSE_ROUTE = "/modes/code/browse";

export const useOpenBrowseTab = () => {
  const navigate = useNavigate();
  return (file: string, line?: number) =>
    void navigate({
      to: BROWSE_ROUTE,
      search: { file, line, tab: "permanent" },
    });
};
