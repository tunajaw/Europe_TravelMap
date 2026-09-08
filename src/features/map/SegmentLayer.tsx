import { useEffect, useRef, useState } from 'react';
import type { SegmentRoute } from './segment-geometry.ts';
import { TRANSPORT_COLORS } from './transport-colors.ts';

export function SegmentLayer({ routes }: { routes: SegmentRoute[] }) {
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearLeave() { if (leaveTimer.current) clearTimeout(leaveTimer.current); }
  function clear() { clearLeave(); setHoverGroup(null); setPinnedGroup(null); }
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!event.composedPath().some((node) => node instanceof Element && node.hasAttribute('data-segment-id'))) clear();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => { clearLeave(); document.removeEventListener('click', outside); document.removeEventListener('keydown', escape); };
  }, []);
  const activeGroup = hoverGroup ?? pinnedGroup;
  function enter(group: string) { clearLeave(); setHoverGroup(group); }
  function leave() {
    clearLeave();
    // Keep the bundle open while the pointer crosses the gaps between lanes.
    leaveTimer.current = setTimeout(() => setHoverGroup(null), 150);
  }
  return <g role="group" aria-label="Travel routes">
    {routes.map((route) => {
      const expanded = route.groupKey === activeGroup;
      return <g key={route.id} data-segment-id={route.id} className={`segment-route${expanded ? ' segment-route--expanded' : ''}`}
        role="button" tabIndex={0} aria-label={`Expand route ${route.label}`} aria-pressed={pinnedGroup === route.groupKey}
        style={{ color: TRANSPORT_COLORS[route.category] }}
        onMouseEnter={() => enter(route.groupKey)} onMouseLeave={leave}
        onFocus={() => enter(route.groupKey)} onBlur={leave}
        onClick={(event) => { event.stopPropagation(); setPinnedGroup(route.groupKey); }}
        onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setPinnedGroup(route.groupKey); } }}>
        {expanded && <path className="segment-route-hit" d={route.collapsedPath} />}
        <path className="segment-route-hit" d={expanded ? route.expandedPath : route.collapsedPath} />
        <path data-testid="segment-path" data-route-group={route.groupKey} className="segment-route-line"
          d={expanded ? route.expandedPath : route.collapsedPath} />
      </g>;
    })}
  </g>;
}
