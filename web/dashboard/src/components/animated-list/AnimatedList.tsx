/**
 * Watchtower selectable list — replaces former React Bits Animated List vendor.
 * Keeps the same controlled-selection API used by Spark / Mods.
 */
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import './AnimatedList.css';

export type AnimatedListProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number, selected: boolean) => ReactNode;
  isSelectable?: (item: T, index: number) => boolean;
  selectedIndex?: number;
  onItemSelect?: (item: T, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  itemClassName?: string;
  displayScrollbar?: boolean;
};

export default function AnimatedList<T>({
  items,
  getKey,
  renderItem,
  isSelectable = () => true,
  selectedIndex = -1,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
}: AnimatedListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!enableArrowNavigation || !onItemSelect) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const selectable = items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => isSelectable(item, index));
    if (!selectable.length) return;
    const cur = selectable.findIndex(({ index }) => index === selectedIndex);
    if (e.key === 'Enter' || e.key === ' ') {
      const hit = selectable[Math.max(0, cur)]!;
      onItemSelect(hit.item, hit.index);
      return;
    }
    const next =
      e.key === 'ArrowDown'
        ? selectable[(cur + 1 + selectable.length) % selectable.length]!
        : selectable[(cur - 1 + selectable.length) % selectable.length]!;
    onItemSelect(next.item, next.index);
  }

  return (
    <div className={cn('scroll-list-container', className)}>
      {showGradients ? <div className="top-gradient" aria-hidden /> : null}
      <div
        ref={listRef}
        className={cn('scroll-list', !displayScrollbar && 'no-scrollbar')}
        tabIndex={enableArrowNavigation ? 0 : undefined}
        role="listbox"
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => {
          const selected = index === selectedIndex;
          const selectable = isSelectable(item, index);
          return (
            <div
              key={getKey(item, index)}
              data-index={index}
              className={cn('animated-list__item-wrap', itemClassName)}
              onClick={() => {
                if (selectable) onItemSelect?.(item, index);
              }}
              role={selectable ? 'option' : undefined}
              aria-selected={selectable ? selected : undefined}
            >
              <div
                className={cn(
                  'animated-list__item',
                  selectable && 'is-selectable',
                  selected && 'is-selected',
                )}
              >
                {renderItem(item, index, selected)}
              </div>
            </div>
          );
        })}
      </div>
      {showGradients ? <div className="bottom-gradient" aria-hidden /> : null}
    </div>
  );
}
