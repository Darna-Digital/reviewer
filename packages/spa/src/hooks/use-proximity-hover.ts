import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  containerGeometryOf,
  itemIndexAtPointer,
  layoutRectOf,
  sameLayoutRects,
  toViewportRect,
  type LayoutRect,
  type ProximityAxis,
} from "./proximity-geometry";

export type ItemRect = LayoutRect;

interface UseProximityHoverOptions {
  axis?: ProximityAxis;
}

interface UseProximityHoverReturn {
  activeIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  itemRects: ItemRect[];
  sessionRef: RefObject<number>;
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  registerItem: (index: number, element: HTMLElement | null) => void;
  measureItems: () => void;
}

export function useProximityHover<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  options: UseProximityHoverOptions = {}
): UseProximityHoverReturn {
  const { axis = "y" } = options;
  const itemsRef = useRef(new Map<number, HTMLElement>());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [itemRects, setItemRects] = useState<ItemRect[]>([]);
  const itemRectsRef = useRef<ItemRect[]>([]);
  const sessionRef = useRef(0);
  const trackPointerFrame = useRef<number | null>(null);
  const remeasureFrame = useRef<number | null>(null);

  const measureItems = useCallback(() => {
    if (containerRef.current === null) return;
    const rects: ItemRect[] = [];
    itemsRef.current.forEach((element, index) => {
      rects[index] = layoutRectOf(element);
    });
    if (sameLayoutRects(itemRectsRef.current, rects)) return;
    itemRectsRef.current = rects;
    setItemRects(rects);
  }, [containerRef]);

  const scheduleRemeasure = useCallback(() => {
    if (remeasureFrame.current !== null) {
      cancelAnimationFrame(remeasureFrame.current);
    }
    remeasureFrame.current = requestAnimationFrame(() => {
      remeasureFrame.current = null;
      measureItems();
    });
  }, [measureItems]);

  const registerItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (element === null) {
        itemsRef.current.delete(index);
      } else {
        itemsRef.current.set(index, element);
      }
      scheduleRemeasure();
    },
    [scheduleRemeasure]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const pointer = { x: event.clientX, y: event.clientY };

      if (trackPointerFrame.current !== null) {
        cancelAnimationFrame(trackPointerFrame.current);
      }
      trackPointerFrame.current = requestAnimationFrame(() => {
        trackPointerFrame.current = null;
        const container = containerRef.current;
        if (container === null) return;
        const geometry = containerGeometryOf(container);
        const rects = itemRectsRef.current.map((rect) =>
          rect === undefined ? undefined : toViewportRect(rect, geometry)
        );
        setActiveIndex(itemIndexAtPointer(pointer, rects, axis));
      });
    },
    [axis, containerRef]
  );

  const handleMouseEnter = useCallback(() => {
    sessionRef.current += 1;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (trackPointerFrame.current !== null) {
      cancelAnimationFrame(trackPointerFrame.current);
      trackPointerFrame.current = null;
    }
    setActiveIndex(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(scheduleRemeasure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, scheduleRemeasure]);

  useEffect(
    () => () => {
      if (trackPointerFrame.current !== null) {
        cancelAnimationFrame(trackPointerFrame.current);
      }
      if (remeasureFrame.current !== null) {
        cancelAnimationFrame(remeasureFrame.current);
      }
    },
    []
  );

  return {
    activeIndex,
    setActiveIndex,
    itemRects,
    sessionRef,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    registerItem,
    measureItems,
  };
}

export function useRegisterProximityItem(
  registerItem: (index: number, element: HTMLElement | null) => void,
  index: number,
  ref: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    registerItem(index, ref.current);
    return () => registerItem(index, null);
  }, [index, registerItem, ref]);
}
