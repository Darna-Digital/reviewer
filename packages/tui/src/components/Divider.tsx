import * as React from 'react';
import { useAppContext } from './AppContext';

/** The rule between sidebar and diff; dragging it resizes the sidebar. */
export function Divider({ onDragStart }: { onDragStart: () => void }) {
  const { palette, bodyHeight } = useAppContext();
  const [hovered, setHovered] = React.useState(false);
  return (
    <box
      width={1}
      height={bodyHeight}
      border={['left']}
      borderStyle={hovered ? 'heavy' : 'single'}
      borderColor={hovered ? palette.accent : palette.rule}
      backgroundColor={palette.frame}
      onMouseDown={onDragStart}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    />
  );
}
