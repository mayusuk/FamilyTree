import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Person, PersonId, RelationshipVertex } from './types';
import { composeDisplayName } from './personName';

interface FamilyTreeViewProps {
  people: Person[];
  relationships: RelationshipVertex[];
  selectedId: PersonId | null;
  focusPersonId?: PersonId | null;
  onSelect: (id: PersonId | null) => void;
}

type TreeTheme = 'classic' | 'modern' | 'minimal' | 'contrast';
const TREE_THEME_STORAGE_KEY = 'family-tree-theme';

function getParentIds(relationships: RelationshipVertex[], childId: PersonId) {
  const parentEdges = relationships.filter((r) => r.type === 'parent' && r.person_b_id === childId);
  return {
    motherId: parentEdges.find((r) => r.role_a === 'mother')?.person_a_id ?? null,
    fatherId: parentEdges.find((r) => r.role_a === 'dad')?.person_a_id ?? null,
  };
}

function getPartnerId(relationships: RelationshipVertex[], personId: PersonId): PersonId | null {
  const edge = relationships.find(
    (r) => r.type === 'partner' && (r.person_a_id === personId || r.person_b_id === personId)
  );
  if (!edge) return null;
  return edge.person_a_id === personId ? edge.person_b_id : edge.person_a_id;
}


function getChildrenIds(relationships: RelationshipVertex[], parentId: PersonId): PersonId[] {
  return relationships
    .filter((r) => r.type === 'parent' && r.person_a_id === parentId && r.role_b === 'child')
    .map((r) => r.person_b_id);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeTreeMetrics(people: Person[], relationships: RelationshipVertex[]) {
  const parentEdges = relationships.filter((r) => r.type === 'parent' && r.role_b === 'child');
  const childrenByParent = new Map<PersonId, Set<PersonId>>();
  const childParentIds = new Map<PersonId, Set<PersonId>>();
  const childrenByParentPair = new Map<string, number>();

  parentEdges.forEach((edge) => {
    const parentSet = childrenByParent.get(edge.person_a_id) ?? new Set<PersonId>();
    parentSet.add(edge.person_b_id);
    childrenByParent.set(edge.person_a_id, parentSet);

    const parents = childParentIds.get(edge.person_b_id) ?? new Set<PersonId>();
    parents.add(edge.person_a_id);
    childParentIds.set(edge.person_b_id, parents);
  });

  [...childParentIds.entries()].forEach(([childId, parentSet]) => {
    const sortedParentIds = [...parentSet].sort();
    const key = sortedParentIds.length > 0 ? sortedParentIds.join('|') : `single:${childId}`;
    childrenByParentPair.set(key, (childrenByParentPair.get(key) ?? 0) + 1);
  });

  const roots = people
    .filter((p) => !childParentIds.has(p.id))
    .map((p) => p.id);
  if (roots.length === 0 && people.length > 0) roots.push(people[0].id);

  const levelById = new Map<PersonId, number>();
  const queue: PersonId[] = [...roots];
  roots.forEach((id) => levelById.set(id, 0));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextLevel = (levelById.get(current) ?? 0) + 1;
    const children = childrenByParent.get(current);
    if (!children) continue;
    children.forEach((childId) => {
      const prev = levelById.get(childId);
      if (prev === undefined || nextLevel > prev) {
        levelById.set(childId, nextLevel);
        queue.push(childId);
      }
    });
  }

  // Fallback for disconnected/cyclic cases.
  people.forEach((p) => {
    if (!levelById.has(p.id)) levelById.set(p.id, 0);
  });

  const generationCounts = new Map<number, number>();
  levelById.forEach((level) => generationCounts.set(level, (generationCounts.get(level) ?? 0) + 1));

  return {
    peopleCount: people.length,
    depth: Math.max(...[...levelById.values(), 0]) + 1,
    maxGenerationWidth: Math.max(...[...generationCounts.values(), 1]),
    maxParentChildren: Math.max(...[...[...childrenByParent.values()].map((s) => s.size), 0]),
    maxCoupleChildren: Math.max(...[...childrenByParentPair.values(), 0]),
  };
}

function computeGlobalDensityScale(metrics: ReturnType<typeof computeTreeMetrics>) {
  let scale = 1;
  if (metrics.peopleCount > 25) scale *= 0.92;
  if (metrics.peopleCount > 60) scale *= 0.84;
  if (metrics.peopleCount > 120) scale *= 0.76;

  if (metrics.maxGenerationWidth > 8) scale *= 0.9;
  if (metrics.maxGenerationWidth > 16) scale *= 0.8;
  if (metrics.maxGenerationWidth > 30) scale *= 0.72;

  if (metrics.maxCoupleChildren > 6) scale *= 0.88;
  if (metrics.maxCoupleChildren > 12) scale *= 0.78;
  if (metrics.maxCoupleChildren > 24) scale *= 0.68;

  if (metrics.depth > 5) scale *= 0.92;
  if (metrics.depth > 8) scale *= 0.84;

  return clamp(scale, 0.6, 1);
}

function scrollNodeIntoView(element: HTMLElement | null) {
  element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

function getNodeStatus(person: Person): 'you' | 'deceased' | null {
  if (person.isCurrentUser) return 'you';
  if (person.deathDate) return 'deceased';
  return null;
}

function PersonCircle({
  person,
  isSelected,
  onClick,
}: {
  person: Person;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const status = getNodeStatus(person);
  const displayName = composeDisplayName(person);

  return (
    <button
      type="button"
      className={`tree-circle ${isSelected ? 'selected' : ''} ${status ? `status-${status}` : ''}`}
      onClick={onClick}
      data-tree-node
      data-person-id={person.id}
    >
      {status && <span className="tree-circle-dot" data-status={status} />}
      <span className="tree-circle-name">{displayName}</span>
      {person.isCurrentUser && <span className="tree-circle-you">You</span>}
    </button>
  );
}

function CoupleRow({
  person,
  spouse,
  peopleById,
  relationships,
  selectedId,
  onSelect,
  rootIds,
  showIncomingEdge,
  globalDensityScale,
}: {
  person: Person;
  spouse: Person | null;
  peopleById: Map<PersonId, Person>;
  relationships: RelationshipVertex[];
  selectedId: PersonId | null;
  onSelect: (id: PersonId | null) => void;
  rootIds?: Set<PersonId>;
  showIncomingEdge?: boolean;
  globalDensityScale: number;
}) {
  const allPeople = [...peopleById.values()];
  const children = spouse
    ? allPeople.filter((p) => {
        const { motherId, fatherId } = getParentIds(relationships, p.id);
        return (
          (motherId === person.id && fatherId === spouse.id) ||
          (motherId === spouse.id && fatherId === person.id)
        );
      })
    : allPeople.filter((p) => {
        const { motherId, fatherId } = getParentIds(relationships, p.id);
        const isChild = motherId === person.id || fatherId === person.id;
        const otherParentId = motherId === person.id ? fatherId : motherId;
        if (!isChild) return false;
        return !otherParentId || !rootIds?.has(otherParentId);
      });

  const childPressureScale = children.length <= 3
    ? 1
    : Math.sqrt(6 / Math.max(1, children.length));
  const compactScale = clamp(childPressureScale * globalDensityScale, 0.38, 1);
  const partnerLabel = compactScale < 0.55 ? 'P' : 'Partner';
  const branchStyle: React.CSSProperties = {
    ['--node-size' as any]: `${Math.round(90 * compactScale)}px`,
    ['--node-font-size' as any]: `${0.7 * compactScale}rem`,
    ['--node-you-font-size' as any]: `${0.6 * compactScale}rem`,
    ['--partner-gap' as any]: `${Math.max(0.45, 1.1 * compactScale)}rem`,
    ['--connector-h-width' as any]: `${Math.max(18, Math.round(34 * compactScale))}px`,
    ['--connector-v-height' as any]: `${Math.max(9, Math.round(20 * compactScale))}px`,
    ['--child-gap-x' as any]: `${Math.max(0.35, 1.8 * compactScale)}rem`,
    ['--child-gap-y' as any]: `${Math.max(0.35, 1.2 * compactScale)}rem`,
    ['--line-label-font-size' as any]: `${Math.max(0.42, 0.56 * compactScale)}rem`,
  };

  const handleClick = (e: React.MouseEvent, id: PersonId) => {
    onSelect(id);
    const wrapper = (e.target as HTMLElement).closest<HTMLElement>('[data-tree-node]');
    scrollNodeIntoView(wrapper);
  };

  return (
    <div
      className={`tree-couple-block ${children.length > 0 ? 'has-children' : ''}`}
      data-person-id={person.id}
      style={branchStyle}
    >
      <div className={`tree-couple-row ${spouse && children.length > 0 ? 'with-spouse-children' : ''}`}>
        <div className="tree-primary-node-wrap">
          {showIncomingEdge && <div className="tree-incoming-edge" />}
          <PersonCircle
            person={person}
            isSelected={selectedId === person.id}
            onClick={(e) => handleClick(e, person.id)}
          />
        </div>
        {spouse && (
          <>
            <div className="tree-connector-h-wrap">
              <div className="tree-connector-h" />
              <span className={`tree-line-label ${compactScale < 0.55 ? 'tiny' : ''}`}>{partnerLabel}</span>
            </div>
            <PersonCircle
              person={spouse}
              isSelected={selectedId === spouse.id}
              onClick={(e) => handleClick(e, spouse.id)}
            />
          </>
        )}
      </div>
      {children.length > 0 && (
        <>
          <div className="tree-connector-v-wrap">
            <div className="tree-connector-v" />
            <span className="tree-line-label">{children.length > 1 ? 'Children' : 'Child'}</span>
          </div>
          <div className={`tree-children-row ${children.length === 1 ? 'single-child' : ''}`}>
            {children.map((child) => {
              const partnerId = getPartnerId(relationships, child.id);
              const childSpouse = partnerId ? (peopleById.get(partnerId) ?? null) : null;
              return (
                <CoupleRow
                  key={child.id}
                  person={child}
                  spouse={childSpouse}
                  peopleById={peopleById}
                  relationships={relationships}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  rootIds={rootIds}
                  showIncomingEdge
                  globalDensityScale={globalDensityScale}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function buildVisiblePersonSet(
  people: Person[],
  relationships: RelationshipVertex[],
  focusPersonId: PersonId | null | undefined
): Set<PersonId> {
  if (!focusPersonId) return new Set(people.map((p) => p.id));
  const set = new Set<PersonId>([focusPersonId]);

  const walkAncestors = (id: PersonId) => {
    const { motherId, fatherId } = getParentIds(relationships, id);
    [motherId, fatherId].forEach((pid) => {
      if (pid && !set.has(pid)) {
        set.add(pid);
        walkAncestors(pid);
      }
    });
  };
  const walkDescendants = (id: PersonId) => {
    getChildrenIds(relationships, id).forEach((cid) => {
      if (!set.has(cid)) {
        set.add(cid);
        walkDescendants(cid);
      }
    });
  };

  walkAncestors(focusPersonId);
  walkDescendants(focusPersonId);

  [...set].forEach((id) => {
    const partnerId = getPartnerId(relationships, id);
    if (partnerId) set.add(partnerId);
  });

  return set;
}

function getDisplayRoots(people: Person[], relationships: RelationshipVertex[]): Person[] {
  const roots = people.filter((p) => {
    const { motherId, fatherId } = getParentIds(relationships, p.id);
    return !motherId && !fatherId;
  });
  const nonRootIds = new Set(
    people.filter((p) => {
      const { motherId, fatherId } = getParentIds(relationships, p.id);
      return Boolean(motherId || fatherId);
    }).map((p) => p.id)
  );
  return roots.filter((root) => {
    const partnerId = getPartnerId(relationships, root.id);
    return !partnerId || !nonRootIds.has(partnerId);
  });
}

function getRootGroups(people: Person[], relationships: RelationshipVertex[]): Person[][] {
  const roots = getDisplayRoots(people, relationships);
  const rootIds = new Set(roots.map((r) => r.id));
  const used = new Set<PersonId>();
  const groups: Person[][] = [];
  roots.forEach((root) => {
    if (used.has(root.id)) return;
    const partnerId = getPartnerId(relationships, root.id);
    if (partnerId && rootIds.has(partnerId) && !used.has(partnerId)) {
      const partner = roots.find((r) => r.id === partnerId);
      if (partner) {
        groups.push([root, partner]);
        used.add(root.id);
        used.add(partner.id);
        return;
      }
    }
    groups.push([root]);
    used.add(root.id);
  });
  return groups;
}

export function FamilyTreeView({
  people,
  relationships,
  selectedId,
  focusPersonId,
  onSelect,
}: FamilyTreeViewProps) {
  const treeViewRef = useRef<HTMLDivElement>(null);
  const treeViewportRef = useRef<HTMLDivElement>(null);
  const treeDiagramRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStateRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });
  const touchStateRef = useRef<{
    touching: boolean;
    lastX: number;
    lastY: number;
    pinching: boolean;
    lastDist: number;
    lastCenterX: number;
    lastCenterY: number;
  }>({
    touching: false,
    lastX: 0,
    lastY: 0,
    pinching: false,
    lastDist: 0,
    lastCenterX: 0,
    lastCenterY: 0,
  });
  const doubleTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  // Refs to hold latest zoom/pan so native listeners always see current values
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const [theme, setTheme] = useState<TreeTheme>(() => {
    const stored = localStorage.getItem(TREE_THEME_STORAGE_KEY);
    if (stored === 'classic' || stored === 'modern' || stored === 'minimal' || stored === 'contrast') {
      return stored;
    }
    return 'classic';
  });

  const visibleIds = useMemo(
    () => buildVisiblePersonSet(people, relationships, focusPersonId),
    [people, relationships, focusPersonId]
  );
  const scopedPeople = useMemo(() => people.filter((p) => visibleIds.has(p.id)), [people, visibleIds]);
  const scopedRelationships = useMemo(
    () => relationships.filter((r) => visibleIds.has(r.person_a_id) && visibleIds.has(r.person_b_id)),
    [relationships, visibleIds]
  );
  const peopleById = useMemo(() => new Map(scopedPeople.map((p) => [p.id, p])), [scopedPeople]);

  const roots = getDisplayRoots(scopedPeople, scopedRelationships);
  const rootIds = new Set(roots.map((r) => r.id));
  const rootGroups = getRootGroups(scopedPeople, scopedRelationships);
  const metrics = useMemo(
    () => computeTreeMetrics(scopedPeople, scopedRelationships),
    [scopedPeople, scopedRelationships]
  );
  const globalDensityScale = useMemo(
    () => computeGlobalDensityScale(metrics),
    [metrics]
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      const current = treeViewRef.current;
      setIsFullscreen(Boolean(current && document.fullscreenElement === current));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-enter fullscreen on mobile when tree view mounts
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;
    const el = treeViewRef.current;
    if (!el) return;
    // Small delay to ensure the DOM is ready
    const timer = setTimeout(async () => {
      try {
        await el.requestFullscreen();
      } catch {
        // Fallback for iOS Safari
        setIsFullscreen(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(TREE_THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleFullscreen = async () => {
    const el = treeViewRef.current;
    if (!el) return;

    // Check for native Fullscreen API first
    if (document.fullscreenElement === el) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
      return;
    }
    if (document.fullscreenElement) return;

    try {
      await el.requestFullscreen();
    } catch {
      // Fallback for iOS Safari which doesn't support Fullscreen API
      setIsFullscreen((prev) => !prev);
    }
  };

  const zoomAtPoint = (clientX: number, clientY: number, nextZoom: number) => {
    const viewport = treeViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const clampedZoom = clamp(nextZoom, 0.3, 3);
    const currentZoom = zoomRef.current;

    setPan((prev) => {
      const contentX = (pointX - prev.x) / currentZoom;
      const contentY = (pointY - prev.y) / currentZoom;
      return {
        x: pointX - contentX * clampedZoom,
        y: pointY - contentY * clampedZoom,
      };
    });
    setZoom(clampedZoom);
  };

  const zoomFromCenter = (nextZoom: number) => {
    const viewport = treeViewportRef.current;
    if (!viewport) {
      setZoom(clamp(nextZoom, 0.3, 3));
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom);
  };

  const fitToScreen = () => {
    const viewport = treeViewportRef.current;
    const diagram = treeDiagramRef.current;
    if (!viewport || !diagram) return;
    const viewportRect = viewport.getBoundingClientRect();
    const diagramRect = diagram.getBoundingClientRect();
    const naturalWidth = Math.max(1, diagramRect.width / zoom);
    const naturalHeight = Math.max(1, diagramRect.height / zoom);
    const padding = 48;
    const targetZoom = clamp(
      Math.min(
        (viewportRect.width - padding) / naturalWidth,
        (viewportRect.height - padding) / naturalHeight,
        2
      ),
      0.3,
      3
    );

    const centeredX = (viewportRect.width - naturalWidth * targetZoom) / 2;
    const centeredY = (viewportRect.height - naturalHeight * targetZoom) / 2;
    setZoom(targetZoom);
    setPan({ x: centeredX, y: Math.max(8, centeredY) });
  };

  // Native wheel handler (non-passive) for trackpad pinch-to-zoom
  useEffect(() => {
    const viewport = treeViewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      // Trackpad pinch is exposed as ctrl/meta + wheel in most browsers.
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const intensity = Math.exp(-event.deltaY * 0.002);
      zoomAtPoint(event.clientX, event.clientY, zoomRef.current * intensity);
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewportDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.altKey ? 0.8 : 1.25;
    zoomAtPoint(event.clientX, event.clientY, zoom * factor);
  };

  const handleViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Avoid hijacking node clicks.
    const target = event.target as HTMLElement;
    if (target.closest('[data-tree-node]')) return;
    if (event.button !== 0) return;
    dragStateRef.current = { dragging: true, lastX: event.clientX, lastY: event.clientY };
  };

  const handleViewportMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging) return;
    const deltaX = event.clientX - dragStateRef.current.lastX;
    const deltaY = event.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
    setPan((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
  };

  const endViewportDrag = () => {
    dragStateRef.current.dragging = false;
  };

  // --- Native (non-passive) touch handlers for mobile pan + pinch-to-zoom + double-tap ---
  // React synthetic touch events are passive by default, so preventDefault()
  // is silently ignored. We attach handlers directly via addEventListener with
  // { passive: false } so we can suppress the browser's native pinch/scroll.
  const DOUBLE_TAP_DELAY = 300; // ms
  const DOUBLE_TAP_DISTANCE = 30; // px

  useEffect(() => {
    const viewport = treeViewportRef.current;
    if (!viewport) return;

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const nativeZoomAtPoint = (clientX: number, clientY: number, nextZoom: number) => {
      const rect = viewport.getBoundingClientRect();
      const pointX = clientX - rect.left;
      const pointY = clientY - rect.top;
      const clampedZoom = clamp(nextZoom, 0.3, 3);
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const contentX = (pointX - currentPan.x) / currentZoom;
      const contentY = (pointY - currentPan.y) / currentZoom;
      setPan({
        x: pointX - contentX * clampedZoom,
        y: pointY - contentY * clampedZoom,
      });
      setZoom(clampedZoom);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = getTouchDist(e.touches[0], e.touches[1]);
        touchStateRef.current = {
          touching: false,
          lastX: 0,
          lastY: 0,
          pinching: true,
          lastDist: d,
          lastCenterX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          lastCenterY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        // Cancel any pending double-tap when pinch starts
        doubleTapRef.current = null;
      } else if (e.touches.length === 1) {
        const target = e.touches[0].target as HTMLElement;
        if (target.closest('[data-tree-node]')) return;
        e.preventDefault();
        touchStateRef.current = {
          ...touchStateRef.current,
          touching: true,
          lastX: e.touches[0].clientX,
          lastY: e.touches[0].clientY,
          pinching: false,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const ts = touchStateRef.current;
      if (ts.pinching && e.touches.length === 2) {
        e.preventDefault();
        const d = getTouchDist(e.touches[0], e.touches[1]);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const scale = d / ts.lastDist;
        nativeZoomAtPoint(cx, cy, zoomRef.current * scale);
        // Also pan with the pinch center movement
        setPan((prev) => ({
          x: prev.x + (cx - ts.lastCenterX),
          y: prev.y + (cy - ts.lastCenterY),
        }));
        ts.lastDist = d;
        ts.lastCenterX = cx;
        ts.lastCenterY = cy;
      } else if (ts.touching && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - ts.lastX;
        const dy = e.touches[0].clientY - ts.lastY;
        ts.lastX = e.touches[0].clientX;
        ts.lastY = e.touches[0].clientY;
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const ts = touchStateRef.current;
      const wasPinching = ts.pinching;
      ts.touching = false;
      ts.pinching = false;

      // Double-tap detection: only for single-finger taps that didn't pinch
      if (wasPinching || e.changedTouches.length !== 1) {
        doubleTapRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const now = Date.now();
      const prev = doubleTapRef.current;

      if (
        prev &&
        now - prev.time < DOUBLE_TAP_DELAY &&
        Math.hypot(touch.clientX - prev.x, touch.clientY - prev.y) < DOUBLE_TAP_DISTANCE
      ) {
        // Double-tap detected
        e.preventDefault();
        const currentZoom = zoomRef.current;
        // If already zoomed in (>1.15), reset to 1; otherwise zoom to 2×
        if (currentZoom > 1.15) {
          nativeZoomAtPoint(touch.clientX, touch.clientY, 1);
        } else {
          nativeZoomAtPoint(touch.clientX, touch.clientY, 2);
        }
        doubleTapRef.current = null;
      } else {
        doubleTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      }
    };

    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: false });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when in iOS fullscreen mode
  useEffect(() => {
    if (isFullscreen && !document.fullscreenElement) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!selectedId || !treeViewRef.current) return;
    const node = treeViewRef.current.querySelector<HTMLElement>(`[data-person-id="${selectedId}"]`);
    scrollNodeIntoView(node);
  }, [selectedId]);

  if (people.length === 0) {
    return (
      <div className="tree-empty">
        <p>No family members yet.</p>
        <p className="muted">Add a person from the list to start building your tree.</p>
      </div>
    );
  }

  return (
    <div
      ref={treeViewRef}
      className={`family-tree-view family-tree-view-ref ${isFullscreen ? 'is-fullscreen' : ''}`}
      data-tree-theme={theme}
    >
      {/* Landscape hint — shown only in portrait on mobile */}
      <div className="tree-rotate-hint">
        <span>&#x21BB;</span> Rotate device to landscape for the best view
      </div>

      <div className="tree-toolbar">
        <p className="tree-hint muted">
          Click a person to focus and see details. {focusPersonId ? 'Showing focused family context.' : 'Showing whole tree.'}
          {' '}Auto density: {Math.round(globalDensityScale * 100)}%.
        </p>
        <div className="tree-zoom-controls">
          <button type="button" onClick={() => zoomFromCenter(zoom - 0.1)}>-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => zoomFromCenter(zoom + 0.1)}>+</button>
          <button type="button" onClick={fitToScreen}>Fit</button>
          <button
            type="button"
            className="tree-btn-desktop-only"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </button>
          <button type="button" onClick={toggleFullscreen}>{isFullscreen ? 'Exit' : 'Full screen'}</button>
        </div>
        <div className="tree-theme-controls" role="group" aria-label="Tree theme">
          <button type="button" className={theme === 'classic' ? 'active' : ''} onClick={() => setTheme('classic')}>Classic</button>
          <button type="button" className={theme === 'modern' ? 'active' : ''} onClick={() => setTheme('modern')}>Modern</button>
          <button type="button" className={theme === 'minimal' ? 'active' : ''} onClick={() => setTheme('minimal')}>Minimal</button>
          <button type="button" className={theme === 'contrast' ? 'active' : ''} onClick={() => setTheme('contrast')}>High contrast</button>
        </div>
      </div>

      <div
        ref={treeViewportRef}
        className="tree-viewport"
        onDoubleClick={handleViewportDoubleClick}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleViewportMouseMove}
        onMouseUp={endViewportDrag}
        onMouseLeave={endViewportDrag}
      >
        <div
          ref={treeDiagramRef}
          className="tree-diagram"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}
        >
        {rootGroups.length === 0 ? (
          (() => {
            const first = scopedPeople[0];
            if (!first) return null;
            const partnerId = getPartnerId(scopedRelationships, first.id);
            const spouse = partnerId ? (peopleById.get(partnerId) ?? null) : null;
            return (
              <CoupleRow
                person={first}
                spouse={spouse}
                peopleById={peopleById}
                relationships={scopedRelationships}
                selectedId={selectedId}
                onSelect={onSelect}
                rootIds={rootIds}
                globalDensityScale={globalDensityScale}
              />
            );
          })()
        ) : (
          rootGroups.map((group) => {
            const person = group[0];
            const spouse = group.length === 2 ? group[1] : null;
            return (
              <CoupleRow
                key={person.id}
                person={person}
                spouse={spouse}
                peopleById={peopleById}
                relationships={scopedRelationships}
                selectedId={selectedId}
                onSelect={onSelect}
                rootIds={rootIds}
                globalDensityScale={globalDensityScale}
              />
            );
          })
        )}
      </div>
      </div>

    </div>
  );
}
