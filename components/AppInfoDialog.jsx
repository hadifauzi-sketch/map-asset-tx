import { AlertTriangle, ExternalLink, FileText } from 'lucide-react';
import { APP_DISCLAIMER, APP_METADATA, APP_RELEASE_NOTES } from '../lib/appMetadata';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

function AppInfoDialog({
  open,
  onOpenChange,
  mode = 'about',
  requireAcknowledgement = false,
  onAcknowledge,
}) {
  const isAbout = mode === 'about';

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && requireAcknowledgement) {
      return;
    }

    onOpenChange?.(nextOpen);
  };

  const preventDismiss = (event) => {
    if (requireAcknowledgement) {
      event.preventDefault();
    }
  };

  const handlePrimaryAction = () => {
    if (requireAcknowledgement) {
      onAcknowledge?.();
      return;
    }

    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[760px]"
        showClose={!requireAcknowledgement}
        onEscapeKeyDown={preventDismiss}
        onPointerDownOutside={preventDismiss}
      >
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            <div
              className={
                isAbout
                  ? 'flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-300'
              }
            >
              {isAbout ? <FileText className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="w-fit">
                {isAbout
                  ? `Current version v${APP_METADATA.currentVersion}`
                  : requireAcknowledgement
                    ? 'Login acknowledgement required'
                    : 'Important notice'}
              </Badge>
              <DialogTitle>{isAbout ? 'About this app' : 'Disclaimer'}</DialogTitle>
              <DialogDescription>
                {isAbout
                  ? 'Author details, current version, and recent README release notes.'
                  : 'Please review this notice before relying on app calculations or analysis results.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          {isAbout ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>v{APP_METADATA.currentVersion}</Badge>
                    <Badge variant="outline">README update summary</Badge>
                  </div>
                  <CardTitle>{APP_METADATA.name}</CardTitle>
                  <CardDescription>{APP_METADATA.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Developed by
                    </p>
                    <a
                      href={APP_METADATA.authorUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)] underline-offset-4 hover:underline"
                    >
                      {APP_METADATA.authorName}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p className="mt-2 text-sm text-[var(--muted)]">{APP_METADATA.authorRole}</p>
                  </div>

                  <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      App focus
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{APP_METADATA.focusNote}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>What is new</CardTitle>
                  <CardDescription>
                    Latest version notes pulled from the README update history.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {APP_RELEASE_NOTES.map((release) => (
                    <div
                      key={release.version}
                      className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-[var(--foreground)]">
                          What is new in v{release.version}
                        </div>
                        {release.version === APP_METADATA.currentReleaseSeries ? (
                          <Badge>Current</Badge>
                        ) : (
                          <Badge variant="outline">Previous</Badge>
                        )}
                      </div>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
                        {release.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-[var(--foreground)]">Usage notice</CardTitle>
                <CardDescription>
                  This message appears before app use so the current release limitations stay visible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-[var(--muted)]">
                {APP_DISCLAIMER.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant={requireAcknowledgement ? 'default' : 'outline'} onClick={handlePrimaryAction}>
            {requireAcknowledgement ? 'Okay' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AppInfoDialog;
