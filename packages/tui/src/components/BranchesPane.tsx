import { branchItems } from '../render/listItems';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { List } from './List';
import { TextField } from './TextField';

export function BranchesPane({
  height,
  focused,
}: {
  height: number;
  focused: boolean;
}) {
  const app = useAppContext();
  const { palette, layout, branches, review, actions } = app;
  const width = layout.mainWidth;
  const items = branchItems(palette, branches.rows, {
    remoteOpen: branches.remoteOpen,
    remoteCount: branches.remoteCount,
    compared:
      review.comparison.kind === 'branch' ? review.comparison.against : null,
    aim: review.aim,
  });

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={palette.frame}
    >
      <box
        flexDirection="row"
        height={1}
        width={width}
        backgroundColor={palette.frame}
      >
        <TextField
          palette={palette}
          width={Math.min(40, width - 30)}
          placeholder="Search branches"
          value={branches.query}
          focused={app.typing === 'branchFilter'}
          onInput={branches.setQuery}
          onFocus={() => {
            actions.setFocus('bottom');
            actions.setTyping('branchFilter');
          }}
        />
        <box flexGrow={1} height={1} backgroundColor={palette.frame} />
        <Button
          segs={[
            {
              text: branches.remoteOpen
                ? ' ▾ remotes '
                : ` ▸ remotes ${branches.remoteCount} `,
              fg: palette.muted,
              bg: palette.frame,
            },
          ]}
          bg={palette.frame}
          hoverTint={palette.text}
          onPress={branches.toggleRemote}
        />
        <Button
          segs={[
            { text: ' + New branch ', fg: palette.accent, bg: palette.frame },
          ]}
          bg={palette.frame}
          hoverTint={palette.accent}
          onPress={() => actions.newBranch()}
        />
        <Line segs={[{ text: ' ' }]} width={1} fill={palette.frame} />
      </box>
      <List
        items={items}
        selected={items.findIndex(
          (item) => item.value === branches.rows[branches.selectedIndex],
        )}
        focused={focused}
        width={width}
        height={height - 1}
        palette={palette}
        emptyText={
          branches.query
            ? `No branches match “${branches.query}”`
            : 'No branches'
        }
        onSelect={(item) => {
          actions.setFocus('bottom');
          if (item.value) branches.select(item.value);
        }}
        onActivate={(item) =>
          item.value && actions.checkoutBranch(item.value.branch)
        }
        onContextMenu={(item, at) =>
          item.value && actions.branchMenu(item.value.branch, at)
        }
        onHeading={(item) =>
          item.key === 'head:remote' && branches.toggleRemote()
        }
        onScroll={(delta) => branches.step(delta)}
      />
    </box>
  );
}
