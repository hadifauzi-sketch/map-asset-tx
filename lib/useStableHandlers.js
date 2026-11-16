import { useLayoutEffect, useMemo, useRef } from 'react';

/**
 * Turns an object of event handlers into an object whose functions never
 * change identity but always call the latest version passed in.
 *
 * Use it to hand App's many plain (re-created every render) handlers to a
 * React.memo child such as MapView without breaking the memo, and without
 * listing every closure dependency of every handler.
 *
 * The set of keys must stay the same between renders.
 */
export function useStableHandlers(handlers) {
  const handlersRef = useRef(handlers);

  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  const keySignature = Object.keys(handlers).join('|');

  return useMemo(() => {
    const stable = {};
    keySignature.split('|').forEach((key) => {
      stable[key] = (...args) => handlersRef.current[key]?.(...args);
    });
    return stable;
  }, [keySignature]);
}
