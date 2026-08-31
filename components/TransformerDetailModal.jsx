import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Wrench,
  Building2,
  ChevronDown,
  ChevronUp,
  Droplet,
  FileText,
  Gauge,
  Image as ImageIcon,
  Layers,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  TestTubeDiagonal,
  Zap,
} from 'lucide-react';
import OilTestSection from './OilTestSection';
import DocumentSection from './DocumentSection';
import ImageSection from './ImageSection';
import DataTrending from './DataTrending';
import InterventionSection from './InterventionSection';
import { interventionService } from '../lib/interventionService';
import TransformerHealthDashboard from './TransformerHealthDashboard';
import { AppTooltip } from './ui/app-tooltip';
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
import { getAssetOwnerLabel } from '../lib/assetOwner';
import { isImageDocument } from '../lib/documentUtils';
import { getTransformerState } from '../lib/malaysiaStates';
import { normaliseOilType } from '../lib/oilTypeUtils';
import { getPaperTypeLabel } from '../lib/paperTypeUtils';

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
  companyName = '',
  areaName = '',
  readOnly = false,
  onClose,
  onUpdateOilTests,
  onUpdateDocuments,
  onDgaPreferencesSaved,
}) {
  const [activeTab, setActiveTab] = useState('info');
  const [interventions, setInterventions] = useState([]);
  const [selectedCompartment, setSelectedCompartment] = useState(DEFAULT_COMPARTMENTS[0]);
  const [customCompartments, setCustomCompartments] = useState([]);
  const [oilTestAssignments, setOilTestAssignments] = useState({});
  const [documentAssignments, setDocumentAssignments] = useState({});
  const [compartmentMetrics, setCompartmentMetrics] = useState({});
  const [compartmentMetricForm, setCompartmentMetricForm] = useState({
    voltage: '',
    loadMVA: '',
    manufacturer: '',
  });
  const [isCreateCompartmentOpen, setIsCreateCompartmentOpen] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState('');
  const [newCompartmentError, setNewCompartmentError] = useState('');
  const [isCompartmentPanelOpen, setIsCompartmentPanelOpen] = useState(false);
  const [isMobileChromeHidden, setIsMobileChromeHidden] = useState(false);
  const lastDetailScrollTopRef = useRef(0);

  useEffect(() => {
    setActiveTab('info');
  }, [transformer?.id]);

  useEffect(() => {
    setIsMobileChromeHidden(false);
    lastDetailScrollTopRef.current = 0;
  }, [activeTab, open, transformer?.id]);

  useEffect(() => {
    if (!transformer?.id) {
      setSelectedCompartment(DEFAULT_COMPARTMENTS[0]);
      setCustomCompartments([]);
      setOilTestAssignments({});
      setDocumentAssignments({});
      setCompartmentMetrics({});
      setCompartmentMetricForm({ voltage: '', loadMVA: '', manufacturer: '' });
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
    setCompartmentMetricForm({ voltage: '', loadMVA: '', manufacturer: '' });
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

  // Loaded whenever the record opens rather than only on the Maintenance tab:
  // the Trending tab needs them too, to mark where a baseline was reset.
  useEffect(() => {
    let cancelled = false;

    const loadInterventions = async () => {
      if (!open || !transformer?.id) {
        return;
      }

      try {
        const records = await interventionService.getByTransformerId(transformer.id);
        if (!cancelled) {
          setInterventions(records);
        }
      } catch (error) {
        console.error('Error loading interventions:', error);
      }
    };

    loadInterventions();

    return () => {
      cancelled = true;
    };
  }, [open, transformer?.id]);

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
      manufacturer: sanitizeMetricValue(overrides.manufacturer),
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

  // Interventions carry their compartment as stored text, so they filter the
  // same way oil tests do — an OLTC filtration must not annotate main tank
  // trending. A blank compartment falls back to the default, matching how
  // untagged oil tests behave.
  const filteredInterventions = useMemo(
    () =>
      interventions.filter((intervention) => {
        const compartment = resolveCompartmentName(intervention?.compartment);
        return normalizeCompartmentName(compartment) === selectedCompartmentKey;
      }),
    [availableCompartments, fallbackCompartment, interventions, selectedCompartmentKey]
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
    const manufacturer = sanitizeMetricValue(compartmentMetricForm.manufacturer);

    setCompartmentMetrics((current) => {
      const next = { ...current };
      if (!voltage && !loadMVA && !manufacturer) {
        delete next[selectedCompartmentKey];
        return next;
      }

      next[selectedCompartmentKey] = {
        voltage,
        loadMVA,
        manufacturer,
      };
      return next;
    });
  };

  const handleResetCompartmentMetrics = () => {
    if (readOnly) {
      return;
    }
    setCompartmentMetricForm({ voltage: '', loadMVA: '', manufacturer: '' });
    setCompartmentMetrics((current) => {
      const next = { ...current };
      delete next[selectedCompartmentKey];
      return next;
    });
  };

  const handleDetailScroll = (event) => {
    const scrollTop = event.currentTarget.scrollTop;
    const previousScrollTop = lastDetailScrollTopRef.current;
    const delta = scrollTop - previousScrollTop;
    const isPhoneViewport =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 640px)').matches;

    if (!isPhoneViewport) {
      setIsMobileChromeHidden(false);
      lastDetailScrollTopRef.current = scrollTop;
      return;
    }

    if (scrollTop <= 12 || delta < -8) {
      setIsMobileChromeHidden(false);
    } else if (delta > 8 && scrollTop > 40) {
      setIsMobileChromeHidden(true);
    }

    lastDetailScrollTopRef.current = scrollTop;
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
    maker: sanitizeMetricValue(selectedCompartmentMetrics.manufacturer) || transformer.maker,
  };
  const voltageValue = formatValueWithUnit(
    scopedTransformer.voltage,
    'kV'
  );
  const loadValue = formatValueWithUnit(
    scopedTransformer.loadMVA,
    'MvA'
  );
  const latestOilTest = filteredOilTests[0] || (transformer.oilTests || [])[0];
  const oilTypeValue =
    normaliseOilType(transformer.oilType) ||
    normaliseOilType(latestOilTest?.oilType) ||
    '';
  const paperTypeValue = getPaperTypeLabel(transformer.paperType);
  const assetOwnerLabel = getAssetOwnerLabel(transformer.ownerType);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent
        className={`mobile-fullscreen-dialog ${
          isMobileChromeHidden ? 'mobile-detail-chrome-hidden' : ''
        } !fixed !inset-0 flex !h-screen !max-h-none !w-screen !max-w-none flex-col gap-0 overflow-hidden !rounded-none !border-0 !p-0 sm:!rounded-none`}
      >
        <DialogHeader className="transformer-detail-mobile-chrome transformer-detail-record-header shrink-0 bg-[var(--card-elevated)]">
          <div className="flex flex-col gap-4 pr-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary">Transformer record</Badge>
              <div>
                <DialogTitle className="text-xl sm:text-2xl">{transformer.txName || 'Transformer details'}</DialogTitle>
                <DialogDescription className="mt-1">
                  {transformer.siteName || 'Unknown site'}
                  {transformer.mnemonic ? ` - ${transformer.mnemonic}` : ''}
                  {transformer.serialNumber ? ` - ${transformer.serialNumber}` : ''}
                </DialogDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{transformerState}</Badge>
              <Badge variant="outline">{assetOwnerLabel}</Badge>
              <Badge variant="outline">{voltageValue || 'Voltage N/A'}</Badge>
              <Badge variant="secondary">{loadValue || 'Load N/A'}</Badge>
              <Badge variant="secondary">{selectedCompartmentName}</Badge>
              {transformer.yearBuilt ? <Badge variant="secondary">Built {transformer.yearBuilt}</Badge> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            <div className="transformer-detail-mobile-chrome transformer-detail-mobile-toolbar overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--card-muted)] shadow-sm">
              <button
                type="button"
                onClick={() => setIsCompartmentPanelOpen((v) => !v)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-5 transition-colors ${
                  isCompartmentPanelOpen
                    ? 'hover:bg-[var(--card-elevated)]'
                    : 'bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border-b-0'
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    isCompartmentPanelOpen ? 'text-[var(--muted)]' : 'text-[var(--primary-strong)]'
                  }`}>
                    Compartment
                  </p>
                  {!isCompartmentPanelOpen ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--primary-strong)]">·</span>
                      <span className="inline-flex items-center rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--primary-foreground)]">
                        {selectedCompartmentName}
                      </span>
                      {Object.keys(compartmentMetrics).length > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-[color:var(--primary)]/30 bg-[var(--card)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary-strong)]">
                          {Object.keys(compartmentMetrics).length} override{Object.keys(compartmentMetrics).length !== 1 ? 's' : ''}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-[var(--primary-strong)]/70">· click to expand</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)]">· select to filter records</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {readOnly ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--card)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                      Viewer mode · read-only
                    </span>
                  ) : null}
                  {isCompartmentPanelOpen
                    ? <ChevronUp className="h-4 w-4 text-[var(--muted)]" />
                    : <ChevronDown className="h-4 w-4 text-[var(--primary-strong)]" />}
                </div>
              </button>

              {isCompartmentPanelOpen ? (
                <div>
                  <div className="px-4 pb-3 sm:px-5">
                    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2">
                      {availableCompartments.map((compartmentName) => {
                        const compartmentKey = normalizeCompartmentName(compartmentName);
                        const isActive = compartmentKey === selectedCompartmentKey;
                        const hasOverrides = Boolean(compartmentMetrics[compartmentKey]);

                        return (
                          <button
                            key={compartmentName}
                            type="button"
                            onClick={() => setSelectedCompartment(compartmentName)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                              isActive
                                ? 'border-[color:var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                                : 'border-[color:var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[color:var(--primary)]/40 hover:bg-[var(--card-elevated)]'
                            }`}
                          >
                            <span>{compartmentName}</span>
                            {hasOverrides ? (
                              <AppTooltip content="Has compartment overrides">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isActive ? 'bg-[var(--primary-foreground)]' : 'bg-[var(--primary)]'
                                  }`}
                                  aria-label="Has compartment overrides"
                                />
                              </AppTooltip>
                            ) : null}
                          </button>
                        );
                      })}
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={openCreateCompartmentModal}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[color:var(--primary)] hover:text-[var(--foreground)]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add compartment
                        </button>
                      ) : null}
                    </div>

                    <p className="mt-2.5 text-[11px] text-[var(--muted)]">
                      Oil tests, documents, images, trending, and snapshot counts below are filtered by the selected
                      compartment.
                    </p>
                  </div>

                  <div className="border-t border-[color:var(--border)] bg-[var(--card)] px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-2.5 mb-3">
                      <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                        <Sliders className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {selectedCompartmentName} specifications
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          Override values for this compartment. Leave a field empty to inherit from the transformer record.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2.5 md:grid-cols-3">
                      <CompartmentOverrideField
                        icon={Zap}
                        label="Voltage"
                        name="voltage"
                        value={compartmentMetricForm.voltage}
                        onChange={handleCompartmentMetricInputChange}
                        disabled={readOnly}
                        placeholder="e.g. 33/11"
                        defaultValue={transformer.voltage}
                        defaultUnit="kV"
                      />
                      <CompartmentOverrideField
                        icon={Shield}
                        label="Load"
                        name="loadMVA"
                        value={compartmentMetricForm.loadMVA}
                        onChange={handleCompartmentMetricInputChange}
                        disabled={readOnly}
                        placeholder="e.g. 30"
                        defaultValue={transformer.loadMVA}
                        defaultUnit="MVA"
                      />
                      <CompartmentOverrideField
                        icon={Building2}
                        label="Manufacturer"
                        name="manufacturer"
                        value={compartmentMetricForm.manufacturer}
                        onChange={handleCompartmentMetricInputChange}
                        disabled={readOnly}
                        placeholder="e.g. MR Reinhausen"
                        defaultValue={transformer.maker}
                      />
                    </div>

                    {!readOnly ? (
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleResetCompartmentMetrics}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--card-elevated)]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset to defaults
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCompartmentMetrics}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] shadow-sm transition-colors hover:bg-[var(--primary-strong)]"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save changes
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Tab bar — single scrollable row so all tabs are reachable on any screen size */}
            <div className="transformer-detail-mobile-chrome transformer-detail-mobile-tabs -mx-4 overflow-x-auto border-b border-[color:var(--border)] sm:-mx-5">
              <div className="px-4 pb-3 pt-3 sm:px-5">
                <TabsList className="flex w-max min-w-full gap-1">
                  <TabsTrigger value="info" className="shrink-0">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Information</span>
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="shrink-0">
                    <Gauge className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="oilTests" className="shrink-0">
                    <TestTubeDiagonal className="h-4 w-4" />
                    <span className="hidden sm:inline">Oil tests</span>
                    <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                      {filteredOilTests.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="shrink-0">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Documents</span>
                    <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                      {filteredDocuments.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="images" className="shrink-0">
                    <ImageIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Image</span>
                    <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                      {filteredImages.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="dataTrending" className="shrink-0">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Trending</span>
                  </TabsTrigger>
                  <TabsTrigger value="maintenance" className="shrink-0">
                    <Wrench className="h-4 w-4" />
                    <span className="hidden sm:inline">Maintenance</span>
                    <span className="ml-1 rounded-md bg-[var(--card-muted)] px-1.5 py-0.5 text-xs">
                      {filteredInterventions.length}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div
              className="detail-scroll min-h-0 flex-1 overflow-y-auto py-2 pr-2 sm:py-2 sm:pr-3" //adjust the gap of oil test
              onScroll={handleDetailScroll}
            >
              <TabsContent value="info" className="mt-0 space-y-5">
                <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Asset identity</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <DetailField label="Company / Parent" value={companyName} />
                      <DetailField label="Area" value={areaName} />
                      <DetailField label="Site name" value={transformer.siteName} />
                      <DetailField label="Asset owner" value={assetOwnerLabel} />
                      <DetailField label="State / territory" value={transformerState} />
                      <DetailField label="Transformer name" value={transformer.txName} />
                      <DetailField label="Mnemonic" value={transformer.mnemonic} />
                      <DetailField label="Serial number" value={transformer.serialNumber} />
                      <DetailField label="Manufacturer" value={scopedTransformer.maker} />
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
                      <SummaryMetric icon={Building2} label="Asset owner" value={assetOwnerLabel} />
                      <SummaryMetric icon={Shield} label="Load" value={loadValue || '-'} />
                      <SummaryMetric
                        icon={TestTubeDiagonal}
                        label="Oil test records"
                        value={`${filteredOilTests.length}`}
                      />
                      <SummaryMetric
                        icon={Droplet}
                        label="Type of oil"
                        value={oilTypeValue || '-'}
                      />
                      <SummaryMetric
                        icon={Layers}
                        label="Type of paper"
                        value={paperTypeValue || '-'}
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
                  interventions={filteredInterventions}
                />
              </TabsContent>

              <TabsContent value="maintenance" className="mt-0">
                <InterventionSection
                  transformerId={transformer?.id}
                  interventions={filteredInterventions}
                  oilTests={filteredOilTests}
                  compartmentLabel={selectedCompartmentName}
                  canEdit={!readOnly}
                  onChange={setInterventions}
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

function CompartmentOverrideField({
  icon: Icon,
  label,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  defaultValue,
  defaultUnit,
}) {
  const trimmedDefault = defaultValue !== undefined && defaultValue !== null
    ? String(defaultValue).trim()
    : '';
  const defaultLabel = trimmedDefault
    ? `Default: ${trimmedDefault}${defaultUnit ? ` ${defaultUnit}` : ''}`
    : 'No default value';
  const isOverridden = String(value || '').trim().length > 0;

  return (
    <div
      className={`group rounded-md border bg-[var(--card-muted)] px-3 py-2 transition-colors focus-within:border-[color:var(--primary)] focus-within:bg-[var(--card)] ${
        isOverridden ? 'border-[color:var(--primary)]/50' : 'border-[color:var(--border)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-3.5 w-3.5 text-[var(--muted)]" /> : null}
          <label
            htmlFor={`compartment-field-${name}`}
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
          >
            {label}
          </label>
        </div>
        {isOverridden ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--primary-strong)]">
            Override
          </span>
        ) : null}
      </div>
      <input
        id={`compartment-field-${name}`}
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-1 w-full bg-transparent text-sm font-medium text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/70 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{defaultLabel}</p>
    </div>
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
