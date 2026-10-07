import type { BoxRenderable } from '@opentui/core';
import { useRenderer } from '@opentui/react';
import * as React from 'react';
import { RAIL_WIDTH } from '../app/useWorkspace';
import { useAppContext } from './AppContext';
import { captureMouse } from './captureMouse';

/** The rule between sidebar and editor; drag it to resize the sidebar. */
export function Divider() {
  const { palette, layout, workspace } = useAppContext();
  const renderer = useRenderer();
  const ref = React.useRef<BoxRenderable | null>(null);
  const [active, setActive] = React.useState(false);
  return (
    <box
      ref={ref}
      width={1}
      height={layout.bodyHeight}
      border={['left']}
      borderStyle={active ? 'heavy' : 'single'}
      borderColor={active ? palette.accent : palette.rule}
      backgroundColor={palette.frame}
      onMouseDown={() => captureMouse(renderer, ref.current)}
      onMouseDrag={(event) => workspace.resizeSidebar(event.x - RAIL_WIDTH)}
      onMouseOver={() => setActive(true)}
      onMouseOut={() => setActive(false)}
      onMouseDragEnd={() => setActive(false)}
    />
  );
}
