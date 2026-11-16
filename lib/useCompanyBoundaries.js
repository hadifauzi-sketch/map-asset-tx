import { useMemo, useState } from 'react';
import { createDraftCompanyBoundary, normalizeCompanyBoundary } from './companyBoundaryStorage';
import { companyBoundaryService } from './companyBoundaryService';
import { findTransformersInsidePolygon } from './floorPlanStorage';
import { getTransformerState } from './malaysiaStates';

/**
 * Company / parent boundaries: the saved list, the drawing draft, the metadata
 * dialog and every create / reshape / delete action. Moved out of App.jsx
 * unchanged; returned names match App's, so call sites are untouched.
 *
 * Map selection (selectedCompanyBoundaryId) and map navigation stay in App and
 * are passed in, because they are shared with transformers and floor plans.
 * Floor-plan drawing is mutually exclusive with boundary drawing, so the
 * floor-plan controls are passed in too.
 */
export function useCompanyBoundaries({
  transformers,
  selectedTransformer,
  canEditAssets,
  ensureCanEditAssets,
  showAppNotice,
  setConfirmState,
  setConfirmBusy,
  setIsAddMode,
  selectedCompanyBoundaryId,
  setSelectedCompanyBoundaryId,
  focusCompanyBoundary,
  cancelFloorPlanDrawing,
  clearFloorPlanDraft,
  setSelectedFloorPlanId,
}) {
  const [companyBoundaries, setCompanyBoundaries] = useState([]);
  const [showCompanyBoundaries, setShowCompanyBoundaries] = useState(true);
  const [companyBoundaryDraft, setCompanyBoundaryDraft] = useState(null);
  const [isCompanyBoundaryDialogOpen, setIsCompanyBoundaryDialogOpen] = useState(false);
  const [companyBoundaryDialogDraft, setCompanyBoundaryDialogDraft] = useState(null);

  const selectedCompanyBoundary = useMemo(
    () => companyBoundaries.find((boundary) => boundary.id === selectedCompanyBoundaryId) || null,
    [companyBoundaries, selectedCompanyBoundaryId]
  );

  const loadCompanyBoundaries = async () => {
    try {
      const data = await companyBoundaryService.getAll();
      setCompanyBoundaries(data);
    } catch (err) {
      console.error('Failed to load company boundaries:', err);
      showAppNotice({
        variant: 'warning',
        title: 'Company boundary table not ready',
        description: 'The parent boundary layer needs the company_boundaries database table.',
        detail: err?.message || 'Run the latest Supabase migration, then refresh the app.',
        contextLabel: 'Company boundaries',
      });
    }
  };

  const startCompanyBoundaryDrawing = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setIsAddMode(false);
    cancelFloorPlanDrawing();
    setSelectedFloorPlanId(null);
    setSelectedCompanyBoundaryId(null);
    setCompanyBoundaryDraft(createDraftCompanyBoundary());
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
  };

  const handleEditCompanyBoundary = (boundary) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!boundary) {
      return;
    }

    focusCompanyBoundary(boundary);
    setIsAddMode(false);
    clearFloorPlanDraft();
    setCompanyBoundaryDraft(createDraftCompanyBoundary(boundary));
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
  };

  const handleSaveCompanyBoundaryShape = async (boundary, nextPoints) => {
    if (!ensureCanEditAssets()) {
      return false;
    }
    if (!boundary || !Array.isArray(nextPoints) || nextPoints.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'A company boundary needs at least three points before it can be saved.',
        detail: 'Add more points or continue reshaping the parent boundary, then try saving again.',
        contextLabel: 'Company boundary',
        actionLabel: 'Back to map',
      });
      return false;
    }

    try {
      const normalizedBoundary = normalizeCompanyBoundary({
        ...boundary,
        points: nextPoints,
        createdAt: boundary.createdAt || new Date().toISOString(),
      });

      await companyBoundaryService.upsert(normalizedBoundary);
      const storedBoundaries = await companyBoundaryService.getAll();
      setCompanyBoundaries(storedBoundaries);
      focusCompanyBoundary(normalizedBoundary);
      return true;
    } catch (err) {
      console.error('Failed to reshape company boundary:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save company boundary',
        description: 'The reshaped company boundary could not be saved yet.',
        detail: err?.message || 'Failed to save company boundary. Please try again.',
        contextLabel: 'Company boundary',
      });
      return false;
    }
  };

  const cancelCompanyBoundaryDrawing = () => {
    setCompanyBoundaryDraft(null);
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
  };

  const handleCompanyBoundaryDraftVertexMove = (pointIndex, nextPoint) => {
    if (!canEditAssets) {
      return;
    }
    setCompanyBoundaryDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.map((point, index) => (index === pointIndex ? nextPoint : point)),
          }
        : current
    );
  };

  const handleUndoCompanyBoundaryDraftPoint = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setCompanyBoundaryDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.slice(0, -1),
          }
        : current
    );
  };

  const openCompanyBoundaryMetadataDialog = (draft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setCompanyBoundaryDialogDraft(draft);
    setIsCompanyBoundaryDialogOpen(true);
  };

  const handleEditCompanyBoundaryInfo = (boundary) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!boundary) {
      return;
    }

    focusCompanyBoundary(boundary);
    setCompanyBoundaryDraft(null);
    openCompanyBoundaryMetadataDialog({
      ...createDraftCompanyBoundary(boundary),
      points: boundary.points,
    });
  };

  const openCompanyBoundaryDialogFromDraft = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!companyBoundaryDraft || companyBoundaryDraft.points.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'Draw at least three points on the map to create a company boundary.',
        detail: 'Keep clicking on the map until the parent area has enough points to form a closed boundary.',
        contextLabel: 'Company boundary',
        actionLabel: 'Back to map',
      });
      return;
    }

    const existingBoundary = companyBoundaryDraft.id
      ? companyBoundaries.find((boundary) => boundary.id === companyBoundaryDraft.id) || null
      : null;
    const detectedTransformers = findTransformersInsidePolygon(transformers, companyBoundaryDraft.points);
    const primaryTransformer = detectedTransformers[0] || selectedTransformer || null;

    openCompanyBoundaryMetadataDialog({
      ...createDraftCompanyBoundary({
        ...existingBoundary,
        ...companyBoundaryDraft,
        companyName: existingBoundary?.companyName || primaryTransformer?.siteName || '',
        state: existingBoundary?.state || (primaryTransformer ? getTransformerState(primaryTransformer) : '') || '',
      }),
    });
  };

  const handleSaveCompanyBoundary = async (nextBoundaryDraft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    try {
      const currentBoundary = nextBoundaryDraft?.id
        ? companyBoundaries.find((boundary) => boundary.id === nextBoundaryDraft.id) || null
        : null;
      const normalizedBoundary = normalizeCompanyBoundary({
        ...currentBoundary,
        ...nextBoundaryDraft,
        createdAt: currentBoundary?.createdAt || nextBoundaryDraft?.createdAt || new Date().toISOString(),
      });

      await companyBoundaryService.upsert(normalizedBoundary);
      const storedBoundaries = await companyBoundaryService.getAll();
      setCompanyBoundaries(storedBoundaries);
      setIsCompanyBoundaryDialogOpen(false);
      setCompanyBoundaryDialogDraft(null);
      setCompanyBoundaryDraft(null);
      focusCompanyBoundary(normalizedBoundary);
    } catch (err) {
      console.error('Failed to save company boundary:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save company boundary',
        description: 'The company or parent boundary could not be saved yet.',
        detail: err?.message || 'Failed to save company boundary. Please try again.',
        contextLabel: 'Company boundary',
      });
    }
  };

  const handleDeleteCompanyBoundary = (boundaryId) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    const targetBoundary = companyBoundaries.find((boundary) => boundary.id === boundaryId);
    const boundaryLabel = targetBoundary?.companyName || 'this company boundary';

    const runDelete = async () => {
      try {
        setConfirmBusy(true);
        await companyBoundaryService.delete(boundaryId);
        setCompanyBoundaries((current) => current.filter((boundary) => boundary.id !== boundaryId));
        if (selectedCompanyBoundaryId === boundaryId) {
          setSelectedCompanyBoundaryId(null);
        }
        if (companyBoundaryDraft?.id === boundaryId) {
          setCompanyBoundaryDraft(null);
        }
        setIsCompanyBoundaryDialogOpen(false);
        setCompanyBoundaryDialogDraft(null);
        setConfirmState(null);
      } catch (err) {
        console.error('Failed to delete company boundary:', err);
        showAppNotice({
          variant: 'error',
          title: 'Unable to delete company boundary',
          description: 'The company or parent boundary could not be deleted yet.',
          detail: err?.message || 'Failed to delete company boundary. Please try again.',
          contextLabel: 'Company boundary',
        });
      } finally {
        setConfirmBusy(false);
      }
    };

    setConfirmState({
      title: `Delete ${boundaryLabel}?`,
      description: 'Delete this parent boundary only. Area/floor polygons and transformer records remain unchanged.',
      confirmLabel: 'Delete boundary',
      tone: 'danger',
      onConfirm: runDelete,
    });
  };

  return {
    companyBoundaries,
    setCompanyBoundaries,
    showCompanyBoundaries,
    setShowCompanyBoundaries,
    companyBoundaryDraft,
    setCompanyBoundaryDraft,
    isCompanyBoundaryDialogOpen,
    setIsCompanyBoundaryDialogOpen,
    companyBoundaryDialogDraft,
    setCompanyBoundaryDialogDraft,
    selectedCompanyBoundary,
    loadCompanyBoundaries,
    startCompanyBoundaryDrawing,
    handleEditCompanyBoundary,
    handleSaveCompanyBoundaryShape,
    cancelCompanyBoundaryDrawing,
    handleCompanyBoundaryDraftVertexMove,
    handleUndoCompanyBoundaryDraftPoint,
    openCompanyBoundaryMetadataDialog,
    handleEditCompanyBoundaryInfo,
    openCompanyBoundaryDialogFromDraft,
    handleSaveCompanyBoundary,
    handleDeleteCompanyBoundary,
  };
}
