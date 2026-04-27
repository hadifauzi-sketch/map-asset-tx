import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  FileText,
  Gauge,
  Image as ImageIcon,
  MapPin,
  Shield,
  TestTubeDiagonal,
  Zap,
} from 'lucide-react';
import OilTestSection from './OilTestSection';
import DocumentSection from './DocumentSection';
import ImageSection from './ImageSection';
import DataTrending from './DataTrending';
import TransformerHealthDashboard from './TransformerHealthDashboard';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { documentService } from '../lib/documentService';
import { isImageDocument } from '../lib/documentUtils';
import { getTransformerState } from '../lib/malaysiaStates';

const DEFAULT_COMPARTMENTS = ['Maintank', 'OLTC', 'ETX'];
const COMPARTMENT_STORAGE_KEY = 'asset-tx-map-compartment-v1';

function normalizeCompartmentName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sanitizeCompartmentName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function sanitizeMetricValue(value) {
  return String(value || '').trim();
}

function dedupeCompartments(compartments) {
  const seen = new Set();
  return compartments
    .map((item) => sanitizeCompartmentName(item))
    .filter((item) => {
      if (!item) {
        return false;
      }
      const normalized = normalizeCompartmentName(item);
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

function readCompartmentStorage() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(COMPARTMENT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to read compartment storage:', error);
    return {};
  }
}

function writeCompartmentStorage(nextValue) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(COMPARTMENT_STORAGE_KEY, JSON.stringify(nextValue));
  } catch (error) {
    console.error('Failed to persist compartment storage:', error);
  }
}

function getStoredCompartmentConfig(transformerId) {
  const storage = readCompartmentStorage();
  const entry = storage[transformerId] || {};
  return {
    customCompartments: Array.isArray(entry.customCompartments) ? entry.customCompartments : [],
    oilTestAssignments:
      entry.oilTestAssignments && typeof entry.oilTestAssignments === 'object'
        ? entry.oilTestAssignments
        : {},
    documentAssignments:
      entry.documentAssignments && typeof entry.documentAssignments === 'object'
        ? entry.documentAssignments
        : {},
    compartmentMetrics:
      entry.compartmentMetrics && typeof entry.compartmentMetrics === 'object'
        ? entry.compartmentMetrics
        : {},
  };
}

function persistCompartmentConfig(transformerId, config) {
  const storage = readCompartmentStorage();
  storage[transformerId] = {
    customCompartments: config.customCompartments || [],
    oilTestAssignments: config.oilTestAssignments || {},
    documentAssignments: config.documentAssignments || {},
    compartmentMetrics: config.compartmentMetrics || {},
  };
  writeCompartmentStorage(storage);
}

function TransformerDetailModal({
  open,
  transformer,
  readOnly = false,
  onClose,
  onUpdateOilTests,
  onUpdateDocuments,
  onDgaPreferencesSaved,
}) {
  const [activeTab, setActiveTab] = useState('info');
  const [selectedCompartment, setSelectedCompartment] = useState(DEFAULT_COMPARTMENTS[0]);
  const [customCompartments, setCustomCompartments] = useState([]);
  const [oilTestAssignments, setOilTestAssignments] = useState({});
  const [documentAssignments, setDocumentAssignments] = useState({});
  const [compartmentMetrics, setCompartmentMetrics] = useState({});
  const [compartmentMetricForm, setCompartmentMetricForm] = useState({
    voltage: '',
    loadMVA: '',
  });
  const [isCreateCompartmentOpen, setIsCreateCompartmentOpen] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState('');
  const [newCompartmentError, setNewCompartmentError] = useState('');

  useEffect(() => {
    setActiveTab('info');
  }, [transformer?.id]);

  useEffect(() => {
    if (!transformer?.id) {
      setSelectedCompartment(DEFAULT_COMPARTMENTS[0]);
      setCustomCompartments([]);
      setOilTestAssignments({});
      setDocumentAssignments({});
      setCompartmentMetrics({});
      setCompartmentMetricForm({ voltage: '', loadMVA: '' });
      setIsCreateCompartmentOpen(false);
      setNewCompartmentName('');
      setNewCompartmentError('');
      return;
    }

    const storedConfig = getStoredCompartmentConfig(transformer.id);
    setCustomCompartments(dedupeCompartments(storedConfig.customCompartments));
    setOilTestAssignments(storedConfig.oilTestAssignments || {});
    setDocumentAssignments(storedConfig.documentAssignments || {});
    setCompartmentMetrics(storedConfig.compartmentMetrics || {});
    setCompartmentMetricForm({ voltage: '', loadMVA: '' });
    setIsCreateCompartmentOpen(false);
    setNewCompartmentName('');
    setNewCompartmentError('');
    setSelectedCompartment(DEFAULT_COMPARTMENTS[0]);
  }, [transformer?.id]);

  useEffect(() => {
    if (!readOnly) {
      return;
    }
    setIsCreateCompartmentOpen(false);
  }, [readOnly]);

  useEffect(() => {
    if (!transformer?.id) {
      return;
    }

    persistCompartmentConfig(transformer.id, {
      customCompartments,
      oilTestAssignments,
      documentAssignments,
      compartmentMetrics,
    });
  }, [
    compartmentMetrics,
    customCompartments,
    documentAssignments,
    oilTestAssignments,
    transformer?.id,
  ]);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!transformer?.id || (activeTab !== 'documents' && activeTab !== 'images')) {
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

  const availableCompartments = useMemo(() => {
    const oilTestCompartments = (transformer?.oilTests || []).map(
      (test) =>
        test?.compartment ||
        test?.samplingPoint ||
        test?.sampling_point ||
        oilTestAssignments[String(test?.id)] ||
        ''
    );
    const documentCompartments = (transformer?.documents || []).map(
      (doc) =>
        doc?.compartment ||
        doc?.samplingPoint ||
        doc?.sampling_point ||
        documentAssignments[String(doc?.id)] ||
        ''
    );

    return dedupeCompartments([
      ...DEFAULT_COMPARTMENTS,
      ...customCompartments,
      ...oilTestCompartments,
      ...documentCompartments,
      ...Object.values(oilTestAssignments || {}),
      ...Object.values(documentAssignments || {}),
    ]);
  }, [
    customCompartments,
    documentAssignments,
    oilTestAssignments,
    transformer?.documents,
    transformer?.oilTests,
  ]);

  const fallbackCompartment = availableCompartments[0] || DEFAULT_COMPARTMENTS[0];
  const selectedCompartmentName = useMemo(() => {
    const selectedKey = normalizeCompartmentName(selectedCompartment);
    const matched = availableCompartments.find(
      (compartmentName) => normalizeCompartmentName(compartmentName) === selectedKey
    );
    return matched || fallbackCompartment;
  }, [availableCompartments, fallbackCompartment, selectedCompartment]);

  useEffect(() => {
    if (
      normalizeCompartmentName(selectedCompartment) ===
      normalizeCompartmentName(selectedCompartmentName)
    ) {
      return;
    }
    setSelectedCompartment(selectedCompartmentName);
  }, [selectedCompartment, selectedCompartmentName]);

  const resolveCompartmentName = (value) => {
    const normalized = normalizeCompartmentName(value);
    if (!normalized) {
      return fallbackCompartment;
    }

    const matched = availableCompartments.find(
      (compartmentName) => normalizeCompartmentName(compartmentName) === normalized
    );

    return matched || sanitizeCompartmentName(value) || fallbackCompartment;
  };

  const selectedCompartmentKey = normalizeCompartmentName(selectedCompartmentName);

  useEffect(() => {
    const overrides = compartmentMetrics[selectedCompartmentKey] || {};
    setCompartmentMetricForm({
      voltage: sanitizeMetricValue(overrides.voltage),
      loadMVA: sanitizeMetricValue(overrides.loadMVA),
    });
  }, [compartmentMetrics, selectedCompartmentKey]);

  const filteredOilTests = useMemo(
    () =>
      (transformer?.oilTests || []).filter((test) => {
        const testCompartment = resolveCompartmentName(
          test?.compartment ||
            test?.samplingPoint ||
            test?.sampling_point ||
            oilTestAssignments[String(test?.id)]
        );
        return normalizeCompartmentName(testCompartment) === selectedCompartmentKey;
      }),
    [
      availableCompartments,
      fallbackCompartment,
      oilTestAssignments,
      selectedCompartmentKey,
      transformer?.oilTests,
    ]
  );

  const filteredDocuments = useMemo(
    () =>
      (transformer?.documents || []).filter((doc) => {
        if (isImageDocument(doc)) {
          return false;
        }
        const documentCompartment = resolveCompartmentName(
          doc?.compartment ||
            doc?.samplingPoint ||
            doc?.sampling_point ||
            documentAssignments[String(doc?.id)]
        );
        return normalizeCompartmentName(documentCompartment) === selectedCompartmentKey;
      }),
    [
      availableCompartments,
      documentAssignments,
      fallbackCompartment,
      selectedCompartmentKey,
      transformer?.documents,
    ]
  );

  const filteredImages = useMemo(
    () =>
      (transformer?.documents || []).filter((doc) => {
        if (!isImageDocument(doc)) {
          return false;
        }
        const imageCompartment = resolveCompartmentName(
          doc?.compartment ||
            doc?.samplingPoint ||
            doc?.sampling_point ||
            documentAssignments[String(doc?.id)]
        );
        return normalizeCompartmentName(imageCompartment) === selectedCompartmentKey;
      }),
    [
      availableCompartments,
      documentAssignments,
      fallbackCompartment,
      selectedCompartmentKey,
      transformer?.documents,
    ]
  );

  const assignOilTestCompartment = (testIds, compartmentName = selectedCompartmentName) => {
    const nextCompartment = resolveCompartmentName(compartmentName);
    const ids = Array.isArray(testIds) ? testIds : [testIds];

    setOilTestAssignments((current) => {
      const next = { ...current };
      ids.forEach((id) => {
        if (id === undefined || id === null) {
          return;
        }
        next[String(id)] = nextCompartment;
      });
      return next;
    });
  };

  const assignDocumentCompartment = (documentIds, compartmentName = selectedCompartmentName) => {
    const nextCompartment = resolveCompartmentName(compartmentName);
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];

    setDocumentAssignments((current) => {
      const next = { ...current };
      ids.forEach((id) => {
        if (id === undefined || id === null) {
          return;
        }
        next[String(id)] = nextCompartment;
      });
      return next;
    });
  };

  const openCreateCompartmentModal = () => {
    if (readOnly) {
      return;
    }
    setNewCompartmentName('');
    setNewCompartmentError('');
    setIsCreateCompartmentOpen(true);
  };

  const handleCreateCompartment = (event) => {
    if (readOnly) {
      return;
    }
    if (event?.preventDefault) {
      event.preventDefault();
    }

    const compartmentName = sanitizeCompartmentName(newCompartmentName);

    if (!compartmentName) {
      setNewCompartmentError('Please enter a compartment name.');
      return;
    }

    const existing = availableCompartments.find(
      (name) => normalizeCompartmentName(name) === normalizeCompartmentName(compartmentName)
    );
    if (existing) {
      setNewCompartmentError('This compartment already exists.');
      setSelectedCompartment(existing);
      setIsCreateCompartmentOpen(false);
      return;
    }

    setCustomCompartments((current) => dedupeCompartments([...current, compartmentName]));
    setSelectedCompartment(compartmentName);
    setIsCreateCompartmentOpen(false);
    setNewCompartmentName('');
    setNewCompartmentError('');
  };

  const handleCompartmentMetricInputChange = (event) => {
    const { name, value } = event.target;
    setCompartmentMetricForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveCompartmentMetrics = () => {
    if (readOnly) {
      return;
    }
    const voltage = sanitizeMetricValue(compartmentMetricForm.voltage);
    const loadMVA = sanitizeMetricValue(compartmentMetricForm.loadMVA);

    setCompartmentMetrics((current) => {
      const next = { ...current };
      if (!voltage && !loadMVA) {
        delete next[selectedCompartmentKey];
        return next;
      }

      next[selectedCompartmentKey] = {
        voltage,
        loadMVA,
      };
      return next;
    });
  };

  const handleResetCompartmentMetrics = () => {
    if (readOnly) {
      return;
    }
    setCompartmentMetricForm({ voltage: '', loadMVA: '' });
    setCompartmentMetrics((current) => {
      const next = { ...current };
      delete next[selectedCompartmentKey];
      return next;
    });
  };

  if (!transformer) {
    return null;
  }

  const transformerState = getTransformerState(transformer);
  const selectedCompartmentMetrics = compartmentMetrics[selectedCompartmentKey] || {};
  const scopedTransformer = {
    ...transformer,
    voltage: sanitizeMetricValue(selectedCompartmentMetrics.voltage) || transformer.voltage,
    loadMVA: sanitizeMetricValue(selectedCompartmentMetrics.loadMVA) || transformer.loadMVA,
  };
  const voltageValue = formatValueWithUnit(
    scopedTransformer.voltage,
    'kV'
  );
  const loadValue = formatValueWithUnit(
    scopedTransformer.loadMVA,
    'MvA'
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-fullscreen-dialog h-full w-full max-h-full max-w-full border-0 p-0">
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
              <Badge variant="secondary">{selectedCompartmentName}</Badge>
              {transformer.yearBuilt ? <Badge variant="secondary">Built {transformer.yearBuilt}</Badge> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-3">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Compartments
                </p>
                {availableCompartments.map((compartmentName) => {
                  const isActive =
                    normalizeCompartmentName(compartmentName) ===
                    normalizeCompartmentName(selectedCompartmentName);

                  return (
                    <button
                      key={compartmentName}
                      type="button"
                      onClick={() => setSelectedCompartment(compartmentName)}
                      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                          : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-elevated)]'
                      }`}
                    >
                      {compartmentName}
                    </button>
                  );
                })}
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={openCreateCompartmentModal}
                    className="inline-flex items-center rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--card-elevated)]"
                  >
                    + Add compartment
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Oil tests, documents, images, trending, and snapshot counts below are filtered by the selected
                compartment.
              </p>
              {readOnly ? (
                <p className="mt-2 text-xs font-medium text-[var(--muted)]">
                  Viewer mode: asset details are read-only.
                </p>
              ) : null}

              <div className="mt-3 rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {selectedCompartmentName} rating
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                  <input
                    type="text"
                    name="voltage"
                    value={compartmentMetricForm.voltage}
                    onChange={handleCompartmentMetricInputChange}
                    disabled={readOnly}
                    placeholder={transformer.voltage ? `Voltage (default: ${transformer.voltage})` : 'Voltage'}
                    className="h-10 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 text-sm text-[var(--foreground)] outline-none ring-0 transition-colors focus:border-[color:var(--primary)]"
                  />
                  <input
                    type="text"
                    name="loadMVA"
                    value={compartmentMetricForm.loadMVA}
                    onChange={handleCompartmentMetricInputChange}
                    disabled={readOnly}
                    placeholder={transformer.loadMVA ? `Load (default: ${transformer.loadMVA})` : 'Load (MVA)'}
                    className="h-10 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 text-sm text-[var(--foreground)] outline-none ring-0 transition-colors focus:border-[color:var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCompartmentMetrics}
                    disabled={readOnly}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-strong)]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCompartmentMetrics}
                    disabled={readOnly}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--card-elevated)]"
                  >
                    Use default
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Leave one or both fields empty to inherit transformer values.
                </p>
              </div>
            </div>

            <div className="border-b border-[color:var(--border)] py-4">
              <TabsList className="grid w-full grid-cols-2 gap-1 md:grid-cols-6">
                <TabsTrigger value="info">
                  <Shield className="h-4 w-4" />
                  Information
                </TabsTrigger>
                <TabsTrigger value="dashboard">
                  <Gauge className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="oilTests">
                  <TestTubeDiagonal className="h-4 w-4" />
                  Oil tests
                  <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                    {filteredOilTests.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="h-4 w-4" />
                  Documents
                  <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                    {filteredDocuments.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="images">
                  <ImageIcon className="h-4 w-4" />
                  Image
                  <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                    {filteredImages.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="dataTrending">
                  <BarChart3 className="h-4 w-4" />
                  Trending
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="detail-scroll min-h-0 flex-1 overflow-y-auto py-4 pr-1 sm:py-5">
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
                      <DetailField label="Compartment" value={selectedCompartmentName} />
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
                        value={`${filteredOilTests.length}`}
                      />
                      <SummaryMetric
                        icon={FileText}
                        label="Documents"
                        value={`${filteredDocuments.length}`}
                      />
                      <SummaryMetric
                        icon={ImageIcon}
                        label="Images"
                        value={`${filteredImages.length}`}
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

              <TabsContent value="dashboard" className="mt-0">
                <TransformerHealthDashboard
                  transformer={scopedTransformer}
                  oilTests={filteredOilTests}
                  documents={[...filteredDocuments, ...filteredImages]}
                  compartmentLabel={selectedCompartmentName}
                />
              </TabsContent>

              <TabsContent value="oilTests" className="mt-0">
                <OilTestSection
                  transformerId={transformer.id}
                  oilTests={filteredOilTests}
                  onUpdate={onUpdateOilTests}
                  transformer={scopedTransformer}
                  readOnly={readOnly}
                  activeCompartment={selectedCompartmentName}
                  onAssignCompartment={assignOilTestCompartment}
                  onDgaPreferencesSaved={onDgaPreferencesSaved}
                />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <DocumentSection
                  transformerId={transformer.id}
                  transformerName={transformer.txName}
                  documents={filteredDocuments}
                  oilTests={filteredOilTests}
                  readOnly={readOnly}
                  onUpdate={onUpdateDocuments}
                  onUpdateOilTests={onUpdateOilTests}
                  activeCompartment={selectedCompartmentName}
                  onAssignDocumentCompartment={assignDocumentCompartment}
                  onAssignOilTestCompartment={assignOilTestCompartment}
                  availableCompartments={availableCompartments}
                  getCompartmentForDocument={(doc) =>
                    resolveCompartmentName(
                      doc?.compartment ||
                        doc?.samplingPoint ||
                        doc?.sampling_point ||
                        documentAssignments[String(doc?.id)]
                    )
                  }
                />
              </TabsContent>

              <TabsContent value="images" className="mt-0">
                <ImageSection
                  transformerId={transformer.id}
                  transformerName={transformer.txName}
                  images={filteredImages}
                  readOnly={readOnly}
                  onUpdate={onUpdateDocuments}
                  activeCompartment={selectedCompartmentName}
                  onAssignImageCompartment={assignDocumentCompartment}
                />
              </TabsContent>

              <TabsContent value="dataTrending" className="mt-0">
                <DataTrending
                  oilTests={filteredOilTests}
                  transformer={transformer}
                  readOnly={readOnly}
                  compartmentLabel={selectedCompartmentName}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>

      <Dialog open={isCreateCompartmentOpen} onOpenChange={setIsCreateCompartmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Compartment</DialogTitle>
            <DialogDescription>
              Add a compartment like Maintank, OLTC, ETX, or custom names. Each compartment keeps its own
              oil-test, document, trending, and rating context.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCompartment} className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <label
                htmlFor="new-compartment-name"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Compartment name
              </label>
              <Input
                id="new-compartment-name"
                value={newCompartmentName}
                onChange={(event) => {
                  setNewCompartmentName(event.target.value);
                  if (newCompartmentError) {
                    setNewCompartmentError('');
                  }
                }}
                placeholder="Example: Bushing, Radiator, EXT"
                autoFocus
              />
              {newCompartmentError ? (
                <p className="text-xs text-[var(--danger-strong)]">{newCompartmentError}</p>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Use a clear name so your team can separate records correctly.
                </p>
              )}
            </div>

            <DialogFooter className="px-0 pb-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateCompartmentOpen(false);
                  setNewCompartmentError('');
                  setNewCompartmentName('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Create Compartment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
