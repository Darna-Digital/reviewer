import type { MouseEvent } from '@opentui/core';
import * as React from 'react';
import { mix } from '../render/palette';
import { fitSegs, segsWidth, toStyledText } from '../render/styled';
import type { Seg } from '../render/styled';

export interface LineProps {
  segs: Seg[];
  width: number;
  fill?: string;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
}

/** One row of styled text, cut or padded to exactly `width`. */
export function Line(props: LineProps) {
  const { segs, width, fill, ...handlers } = props;
  return (
    <text
      content={toStyledText(fitSegs(segs, width, fill))}
      width={width}
      height={1}
      wrapMode="none"
      selectable={false}
      {...handlers}
    />
  );
}

export interface ButtonProps {
  segs: Seg[];
  onPress: () => void;
  /** Background the hover tint is mixed into. */
  bg: string;
  hoverTint: string;
}

/** Inline clickable text that tints while hovered. */
export function Button(props: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const bg = hovered ? mix(props.bg, props.hoverTint, 0.18) : props.bg;
  const segs = props.segs.map((seg) => ({
    ...seg,
    bg: seg.bg && !hovered ? seg.bg : bg,
  }));
  return (
    <Line
      segs={segs}
      width={segsWidth(props.segs)}
      fill={bg}
      onMouseDown={props.onPress}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    />
  );
}
