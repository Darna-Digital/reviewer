import type { BoxRenderable, MouseEvent } from '@opentui/core';
import { useRenderer } from '@opentui/react';
import * as React from 'react';
import { useAppContext } from './AppContext';
import { captureMouse } from './captureMouse';

export interface DragRuleProps {
  /** `vertical` sits between columns, `horizontal` between rows. */
  direction: 'vertical' | 'horizontal';
  /** Rows of a vertical rule, columns of a horizontal one. */
  length: number;
  onDrag: (event: MouseEvent) => void;
}

/** A one-cell rule that lights up under the pointer and drags to resize. */
export function DragRule({ direction, length, onDrag }: DragRuleProps) {
  const { palette } = useAppContext();
  const renderer = useRenderer();
  const ref = React.useRef<BoxRenderable | null>(null);
  const [active, setActive] = React.useState(false);
  const vertical = direction === 'vertical';
  return (
    <box
      ref={ref}
      width={vertical ? 1 : length}
      height={vertical ? length : 1}
      border={[vertical ? 'left' : 'top']}
      borderStyle={active ? 'heavy' : 'single'}
      borderColor={active ? palette.accent : palette.rule}
      backgroundColor={palette.frame}
      onMouseDown={() => captureMouse(renderer, ref.current)}
      onMouseDrag={onDrag}
      onMouseOver={() => setActive(true)}
      onMouseOut={() => setActive(false)}
      onMouseDragEnd={() => setActive(false)}
    />
  );
}
