import { Suspense, useState } from 'react';

/**
 * Mounts a lazy dialog the first time it opens and keeps it mounted afterwards,
 * so its code is only downloaded when needed while close animations and
 * in-dialog state still behave exactly as before.
 */
export default function MountWhenOpened({ open, children }) {
  const [hasOpened, setHasOpened] = useState(Boolean(open));
  if (open && !hasOpened) {
    setHasOpened(true);
  }
  if (!hasOpened) {
    return null;
  }
  return <Suspense fallback={null}>{children}</Suspense>;
}
