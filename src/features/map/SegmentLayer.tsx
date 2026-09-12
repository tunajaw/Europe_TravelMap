import { useEffect, useRef, useState } from 'react';
import type { SegmentRoute } from './segment-geometry.ts';
import { TRANSPORT_COLORS } from './transport-colors.ts';

export function SegmentLayer({ routes, highlightedIds = new Set<string>(), onInspect }: {
  routes: SegmentRoute[]; highlightedIds?: Set<string>; onInspect?: (id: string | null) => void;
}) {
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearLeave() { if (leaveTimer.current) clearTimeout(leaveTimer.current); }
  function clear() { clearLeave(); setHoverGroup(null); setPinnedGroup(null); setHoverId(null); setPinnedId(null); }
  useEffect(() => { onInspect?.(hoverId ?? pinnedId); }, [hoverId, pinnedId, onInspect]);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!event.composedPath().some((node) => node instanceof Element && node.matches('[data-segment-id], .segment-details'))) clear();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (hoverId || pinnedId)) { event.preventDefault(); clear(); }
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape, true);
    return () => { clearLeave(); document.removeEventListener('click', outside); document.removeEventListener('keydown', escape, true); };
  }, [hoverId, pinnedId]);
  const activeGroup = hoverGroup ?? pinnedGroup;
  function enter(route: SegmentRoute) { clearLeave(); setHoverGroup(route.groupKey); setHoverId(route.id); }
  function leave() {
    clearLeave();
    // Keep the bundle open while the pointer crosses the gaps between lanes.
    leaveTimer.current = setTimeout(() => { setHoverGroup(null); setHoverId(null); }, 150);
  }
  return <g role="group" aria-label="Travel routes">
    {routes.map((route) => {
      const expanded = route.groupKey === activeGroup;
      const highlighted = highlightedIds.has(route.id) || route.id === (hoverId ?? pinnedId);
      return <g key={route.id} data-segment-id={route.id} className={`segment-route${expanded ? ' segment-route--expanded' : ''}${highlighted ? ' segment-route--highlighted' : ''}`}
        role="button" tabIndex={0} aria-label={`Expand route ${route.label}`} aria-pressed={pinnedId === route.id}
        style={{ color: TRANSPORT_COLORS[route.category] }}
        onMouseEnter={() => enter(route)} onMouseLeave={leave}
        onFocus={() => enter(route)} onBlur={leave}
        onClick={(event) => { event.stopPropagation(); setPinnedGroup(route.groupKey); setPinnedId(route.id); }}
        onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setPinnedGroup(route.groupKey); setPinnedId(route.id); } }}>
        {expanded && <path className="segment-route-hit" d={route.collapsedPath} />}
        <path className="segment-route-hit" d={expanded ? route.expandedPath : route.collapsedPath} />
        <path data-testid="segment-path" data-route-group={route.groupKey} className="segment-route-line"
          d={expanded ? route.expandedPath : route.collapsedPath} />
      </g>;
    })}
  </g>;
}
