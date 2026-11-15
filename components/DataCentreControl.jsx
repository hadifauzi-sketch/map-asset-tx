import { Server } from 'lucide-react';
import { Button } from './ui/button';

export default function DataCentreControl({ settings, onChange }) {
  return (
    <Button size="sm" variant={settings.panelOpen || settings.enabled ? 'default' : 'outline'}
      className="h-9 w-9 shrink-0 p-0" title="Data centres"
      aria-label="Open data centre directory" aria-expanded={settings.panelOpen}
      onClick={() => onChange((current) => ({ ...current, panelOpen: !current.panelOpen }))}>
      <Server className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
