import type { Palette } from '../render/palette';
import { Line } from './Line';

export interface TextFieldProps {
  palette: Palette;
  width: number;
  placeholder: string;
  value: string;
  focused: boolean;
  onInput: (value: string) => void;
  onFocus: () => void;
  bg?: string;
}

/** A one-row search field with a ⌕ glyph; focus is owned by the caller. */
export function TextField(props: TextFieldProps) {
  const { palette, width } = props;
  const bg = props.bg ?? palette.control;
  return (
    <box
      flexDirection="row"
      height={1}
      width={width}
      backgroundColor={bg}
      onMouseDown={props.onFocus}
    >
      <Line
        segs={[
          { text: ' ⌕ ', fg: props.focused ? palette.accent : palette.faint },
        ]}
        width={3}
        fill={bg}
      />
      <input
        focused={props.focused}
        value={props.value}
        placeholder={props.placeholder}
        onInput={props.onInput}
        width={Math.max(1, width - 4)}
        backgroundColor={bg}
        focusedBackgroundColor={bg}
        textColor={palette.text}
        focusedTextColor={palette.text}
        placeholderColor={palette.faint}
        cursorColor={palette.accent}
      />
      <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
    </box>
  );
}
