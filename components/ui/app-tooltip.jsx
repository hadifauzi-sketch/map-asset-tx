import React from 'react';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

function composeHandler(theirs, ours) {
  return (event) => {
    theirs?.(event);
    ours(event);
  };
}

export function AppTooltip({
  align = 'center',
  children,
  className,
  content,
  disabled = false,
  side = 'top',
  sideOffset = 10,
  triggerClassName,
}) {
  const contentRef = React.useRef(null);
  const pointerOffsetRef = React.useRef({ x: '0px', y: '0px' });

  if (!content) {
    return children;
  }

  const applyPointerOffset = React.useCallback((x, y) => {
    pointerOffsetRef.current = { x, y };

    if (!contentRef.current) {
      return;
    }

    contentRef.current.style.setProperty('--app-tooltip-follow-x', x);
    contentRef.current.style.setProperty('--app-tooltip-follow-y', y);
  }, []);

  const resetPointerOffset = React.useCallback(() => {
    applyPointerOffset('0px', '0px');
  }, [applyPointerOffset]);

  const handlePointerMove = React.useCallback(
    (event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        resetPointerOffset();
        return;
      }

      const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      const isVerticalSide = side === 'top' || side === 'bottom';
      const maxX = isVerticalSide ? Math.min(22, Math.max(10, bounds.width * 0.2)) : 10;
      const maxY = isVerticalSide ? Math.min(10, Math.max(4, bounds.height * 0.14)) : Math.min(18, Math.max(8, bounds.height * 0.24));

      applyPointerOffset(
        `${(normalizedX * maxX).toFixed(2)}px`,
        `${(normalizedY * maxY).toFixed(2)}px`
      );
    },
    [applyPointerOffset, resetPointerOffset, side]
  );

  const setContentRef = React.useCallback((node) => {
    contentRef.current = node;
    if (!node) {
      return;
    }

    node.style.setProperty('--app-tooltip-follow-x', pointerOffsetRef.current.x);
    node.style.setProperty('--app-tooltip-follow-y', pointerOffsetRef.current.y);
  }, []);

  const attachPointerTracking = React.useCallback(
    (element) => {
      const sharedProps = {
        onBlur: resetPointerOffset,
        onPointerCancel: resetPointerOffset,
        onPointerLeave: resetPointerOffset,
        onPointerMove: handlePointerMove,
      };

      if (!React.isValidElement(element)) {
        return (
          <span className={cn('inline-flex', triggerClassName)} {...sharedProps}>
            {element}
          </span>
        );
      }

      return React.cloneElement(element, {
        className: cn(element.props.className, triggerClassName),
        onBlur: composeHandler(element.props.onBlur, resetPointerOffset),
        onPointerCancel: composeHandler(element.props.onPointerCancel, resetPointerOffset),
        onPointerLeave: composeHandler(element.props.onPointerLeave, resetPointerOffset),
        onPointerMove: composeHandler(element.props.onPointerMove, handlePointerMove),
      });
    },
    [handlePointerMove, resetPointerOffset, triggerClassName]
  );

  const trigger = disabled
    ? attachPointerTracking(<span className={cn('inline-flex', triggerClassName)}>{children}</span>)
    : attachPointerTracking(children);

  return (
    <Tooltip delayDuration={180}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        ref={setContentRef}
        align={align}
        className={className}
        side={side}
        sideOffset={sideOffset}
      >
        {typeof content === 'string' ? <span className="app-tooltip-copy">{content}</span> : content}
      </TooltipContent>
    </Tooltip>
  );
}
