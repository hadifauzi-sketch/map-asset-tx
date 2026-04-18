import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  FileText,
  MapPin,
  Shield,
  TestTubeDiagonal,
  Zap,
} from 'lucide-react';
import OilTestSection from './OilTestSection';
import DocumentSection from './DocumentSection';
import DataTrending from './DataTrending';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { documentService } from '../lib/documentService';
import { getTransformerState } from '../lib/malaysiaStates';

function TransformerDetailModal({
  open,
  transformer,
  onClose,
  onUpdateOilTests,
  onUpdateDocuments,
}) {
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    setActiveTab('info');
  }, [transformer?.id]);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!transformer?.id || activeTab !== 'documents') {
        return;
      }

      try {
        const documents = await documentService.getByTransformerId(transformer.id);
        onUpdateDocuments(transformer.id, documents);
      } catch (error) {
        console.error('Error loading documents:', error);
      }
    };

    loadDocuments();
  }, [activeTab, onUpdateDocuments, transformer?.id]);

  if (!transformer) {
    return null;
  }

  const transformerState = getTransformerState(transformer);
  const voltageValue = formatValueWithUnit(transformer.voltage, 'kV');
  const loadValue = formatValueWithUnit(transformer.loadMVA, 'MvA');

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="h-[100dvh] w-screen max-h-none max-w-none rounded-none border-0 p-0">
        <DialogHeader className="bg-[var(--card-elevated)]">
          <div className="flex flex-col gap-4 pr-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary">Transformer record</Badge>
              <div>
                <DialogTitle className="text-2xl">{transformer.txName || 'Transformer details'}</DialogTitle>
                <DialogDescription className="mt-1">
                  {transformer.siteName || 'Unknown site'}
                  {transformer.mnemonic ? ` - ${transformer.mnemonic}` : ''}
                  {transformer.serialNumber ? ` - ${transformer.serialNumber}` : ''}
                </DialogDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{transformerState}</Badge>
              <Badge variant="outline">{voltageValue || 'Voltage N/A'}</Badge>
              <Badge variant="secondary">{loadValue || 'Load N/A'}</Badge>
              {transformer.yearBuilt ? <Badge variant="secondary">Built {transformer.yearBuilt}</Badge> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-4 pb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[color:var(--border)] py-4">
              <TabsList className="grid w-full grid-cols-2 gap-1 md:grid-cols-4">
                <TabsTrigger value="info">
                  <Shield className="h-4 w-4" />
                  Information
                </TabsTrigger>
                <TabsTrigger value="oilTests">
                  <TestTubeDiagonal className="h-4 w-4" />
                  Oil tests
                  <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                    {transformer.oilTests?.length || 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="h-4 w-4" />
                  Documents
                  <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                    {transformer.documents?.length || 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="dataTrending">
                  <BarChart3 className="h-4 w-4" />
                  Trending
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="detail-scroll min-h-0 flex-1 overflow-y-auto py-5 pr-1">
              <TabsContent value="info" className="mt-0 space-y-5">
                <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Asset identity</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Site name" value={transformer.siteName} />
                      <DetailField label="State / territory" value={transformerState} />
                      <DetailField label="Transformer name" value={transformer.txName} />
                      <DetailField label="Mnemonic" value={transformer.mnemonic} />
                      <DetailField label="Serial number" value={transformer.serialNumber} />
                      <DetailField label="Manufacturer" value={transformer.maker} />
                      <DetailField label="Year built" value={transformer.yearBuilt} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Performance snapshot</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      <SummaryMetric icon={Zap} label="Voltage" value={voltageValue || '-'} />
                      <SummaryMetric icon={Shield} label="Load" value={loadValue || '-'} />
                      <SummaryMetric
                        icon={TestTubeDiagonal}
                        label="Oil test records"
                        value={`${transformer.oilTests?.length || 0}`}
                      />
                      <SummaryMetric
                        icon={FileText}
                        label="Documents"
                        value={`${transformer.documents?.length || 0}`}
                      />
                    </CardContent>
                  </Card>
                </section>

                <Card>
                  <CardHeader>
                    <CardTitle>Location</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Latitude" mono value={transformer.position?.[0]?.toFixed(6)} />
                      <DetailField label="Longitude" mono value={transformer.position?.[1]?.toFixed(6)} />
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${transformer.position[0]},${transformer.position[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-strong)]"
                    >
                      <MapPin className="h-4 w-4" />
                      Open in Google Maps
                    </a>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="oilTests" className="mt-0">
                <OilTestSection
                  transformerId={transformer.id}
                  oilTests={transformer.oilTests || []}
                  onUpdate={onUpdateOilTests}
                  transformer={transformer}
                />
              </TabsContent>

               <TabsContent value="documents" className="mt-0">
                 <DocumentSection
                   transformerId={transformer.id}
                   transformerName={transformer.txName}
                   documents={transformer.documents || []}
                   onUpdate={onUpdateDocuments}
                   onUpdateOilTests={onUpdateOilTests}
                 />
               </TabsContent>

              <TabsContent value="dataTrending" className="mt-0">
                <DataTrending oilTests={transformer.oilTests || []} transformer={transformer} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value, mono = false }) {
  return (
    <div className="rounded-md bg-[var(--card-muted)] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-sm font-medium text-[var(--foreground)] ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-[var(--card-muted)] px-4 py-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function formatValueWithUnit(value, unit) {
  if (!value && value !== 0) {
    return '';
  }

  const unitPattern = /(?:\s*)(kv|mva)$/i;
  return `${String(value).trim().replace(unitPattern, '').trim()} ${unit}`.trim();
}

export default TransformerDetailModal;
