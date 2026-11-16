import { useCallback, useEffect, useRef, useState } from 'react';

const PANEL_MARGIN = 12;

/**
 * Floating map panel that can be dragged inside its layer (Weather, LST, …).
 *
 * While dragging, the panel is moved directly in the DOM; React state is only
 * committed once on drag end, so the owning component does not re-render on
 * every pointer move.
 *
 * Wire-up:
 *   <div ref={layerRef}>                       // positioning layer
 *     <div ref={panelRef} style={position && { left, top }}>
 *       <header onPointerDown={onDragStart} onPointerMove={onDragMove}
 *               onPointerUp={onDragEnd} onPointerCancel={onDragEnd} />
 */
export function useDraggablePanel(isOpen = true) {
  const layerRef = useRef(null);
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const getConstrainedPosition = useCallback((left, top) => {
    const layer = layerRef.current;
    const panel = panelRef.current;

    if (!layer || !panel) {
      return { left, top };
    }

    const layerRect = layer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const maxLeft = Math.max(PANEL_MARGIN, layerRect.width - panelRect.width - PANEL_MARGIN);
    const maxTop = Math.max(PANEL_MARGIN, layerRect.height - panelRect.height - PANEL_MARGIN);

    return {
      left: Math.min(Math.max(left, PANEL_MARGIN), maxLeft),
      top: Math.min(Math.max(top, PANEL_MARGIN), maxTop),
    };
  }, []);

  const onDragStart = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const layer = layerRef.current;
    const panel = panelRef.current;

    if (!layer || !panel) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const startPosition = getConstrainedPosition(
      panelRect.left - layerRect.left,
      panelRect.top - layerRect.top
    );

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startPosition.left,
      startTop: startPosition.top,
    };

    setPosition(startPosition);
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [getConstrainedPosition]);

  const onDragMove = useCallback((event) => {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = getConstrainedPosition(
      dragState.startLeft + event.clientX - dragState.startX,
      dragState.startTop + event.clientY - dragState.startY
    );
    dragState.latest = nextPosition;
    const panel = panelRef.current;
    if (panel) {
      panel.style.left = `${nextPosition.left}px`;
      panel.style.top = `${nextPosition.top}px`;
    }
    event.preventDefault();
  }, [getConstrainedPosition]);

  const onDragEnd = useCallback((event) => {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    if (dragState.latest) {
      setPosition(dragState.latest);
    }
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  // Keep a moved panel inside the layer when the window is resized.
  useEffect(() => {
    if (!isOpen || !position) {
      return undefined;
    }

    const handleResize = () => {
      setPosition((current) => {
        if (!current) {
          return current;
        }

        const nextPosition = getConstrainedPosition(current.left, current.top);
        return nextPosition.left === current.left && nextPosition.top === current.top
          ? current
          : nextPosition;
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [getConstrainedPosition, isOpen, position]);

  return {
    layerRef,
    panelRef,
    position,
    setPosition,
    isDragging,
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
