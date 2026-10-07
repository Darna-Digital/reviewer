export function centered(outer: number, inner: number): number {
  return Math.max(0, Math.floor((outer - inner) / 2));
}

/** Transparent full-screen layer under a modal; a click on it dismisses. */
export function Backdrop({
  onPress,
  zIndex = 19,
}: {
  onPress: () => void;
  zIndex?: number;
}) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      zIndex={zIndex}
      onMouseDown={onPress}
    />
  );
}
