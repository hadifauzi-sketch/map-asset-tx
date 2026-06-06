import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const DialogOpenContext = React.createContext(false);

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.38, ease: 'easeIn' } },
};

const contentVariants = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.93, y: 22, transition: { duration: 0.42, ease: [0.4, 0, 1, 1] } },
};

const contentVariantsFullscreen = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: 20, transition: { duration: 0.42, ease: [0.4, 0, 1, 1] } },
};

function Dialog({ open, onOpenChange, children, ...props }) {
  return (
    <DialogOpenContext.Provider value={!!open}>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'dialog-overlay fixed inset-0 z-[4000] bg-[color:var(--overlay)] backdrop-blur-md',
        className
      )}
      {...props}
    />
  );
});

const DialogContent = React.forwardRef(function DialogContent(
  { className, children, showClose = true, ...props },
  ref
) {
  const open = React.useContext(DialogOpenContext);
  const isFullscreen =
    typeof className === 'string' &&
    (className.includes('mobile-fullscreen') || className.includes('!h-screen'));
  const cv = isFullscreen ? contentVariantsFullscreen : contentVariants;

  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div
              className="fixed inset-0 z-[4000] bg-[color:var(--overlay)] backdrop-blur-md"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            />
          </DialogPrimitive.Overlay>
          <div className="dialog-viewport">
            <DialogPrimitive.Content ref={ref} forceMount asChild {...props}>
              <motion.div
                className={cn(
                  'dialog-content-shell relative flex w-full max-w-[72rem] max-h-full flex-col overflow-hidden rounded-[20px] border border-[color:var(--border)]/60 bg-[color:var(--card)]/90 p-0 shadow-[var(--shadow-dialog)] backdrop-blur-xl sm:rounded-xl',
                  'focus-visible:outline-none',
                  className
                )}
                variants={cv}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {children}
                {showClose ? (
                  <DialogPrimitive.Close
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] sm:right-4 sm:top-4"
                    aria-label="Close dialog"
                  >
                    <X className="h-4 w-4" />
                  </DialogPrimitive.Close>
                ) : null}
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
});

function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-b border-[color:var(--border)] px-4 py-4 sm:px-5',
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-[color:var(--border)] px-4 py-4 sm:flex-row sm:justify-end sm:px-5',
        className
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-base font-semibold text-[var(--foreground)] sm:text-lg', className)}
      {...props}
    />
  );
});

const DialogDescription = React.forwardRef(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-[var(--muted)]', className)}
      {...props}
    />
  );
});

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
