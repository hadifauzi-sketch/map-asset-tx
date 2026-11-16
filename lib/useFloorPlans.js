import { useCallback, useMemo, useState } from 'react';
import {
  createDraftFloorPlan,
  findTransformersInsidePolygon,
  getPolygonCentroid,
  isPointInsidePolygon,
  normalizeFloorPlan,
} from './floorPlanStorage';
import { floorPlanService } from './floorPlanService';
import { getTransformerState } from './malaysiaStates';

/**
 * Floor plans / areas: the saved list, the drawing draft, the metadata dialog,
 * the floor-detail modal and every create / reshape / delete / unassign
 * action, plus the lookups derived from them. Moved out of App.jsx unchanged;
 * returned names match App's, so call sites are untouched.
 *
 * Map selection (selectedFloorPlanId, selectedCompanyBoundaryId) and map
 * navigation stay in App and are passed in. Company-boundary drawing is
 * mutually exclusive with floor drawing, so its cancel action is passed in.
 */
export function useFloorPlans({
  transformers,
  selectedTransformer,
  canEditAssets,
  ensureCanEditAssets,
  showAppNotice,
  setConfirmState,
  setConfirmBusy,
  setIsAddMode,
  selectedFloorPlanId,
  setSelectedFloorPlanId,
  setSelectedCompanyBoundaryId,
  focusFloorPlan,
  companyBoundaries,
  selectedCompanyBoundary,
  cancelCompanyBoundaryDrawing,
}) {
  const [floorPlans, setFloorPlans] = useState([]);
  const [showFloorPlans, setShowFloorPlans] = useState(true);
  const [floorPlanDraft, setFloorPlanDraft] = useState(null);
  const [isFloorPlanDialogOpen, setIsFloorPlanDialogOpen] = useState(false);
  const [floorPlanDialogDraft, setFloorPlanDialogDraft] = useState(null);
  const [floorDetailFloorPlanId, setFloorDetailFloorPlanId] = useState(null);
  const [isFloorDetailModalOpen, setIsFloorDetailModalOpen] = useState(false);

  const floorPlanByTransformerId = useMemo(() => {
    const assignments = new Map();
    floorPlans.forEach((floorPlan) => {
      floorPlan.transformerIds.forEach((transformerId) => {
        assignments.set(String(transformerId), floorPlan);
      });
    });
    return assignments;
  }, [floorPlans]);

  const floorDetailFloorPlan = useMemo(
    () => floorDetailFloorPlanId ? floorPlans.find((fp) => fp.id === floorDetailFloorPlanId) || null : null,
    [floorPlans, floorDetailFloorPlanId]
  );

  const selectedFloorPlan = useMemo(
    () => floorPlans.find((floorPlan) => floorPlan.id === selectedFloorPlanId) || null,
    [floorPlans, selectedFloorPlanId]
  );

  const selectedCompanyFloors = useMemo(() => {
    if (!selectedCompanyBoundary) {
      return [];
    }

    const companyName = String(selectedCompanyBoundary.companyName || '').trim().toLowerCase();
    return floorPlans.filter(
      (floorPlan) => String(floorPlan.companyName || '').trim().toLowerCase() === companyName
    );
  }, [floorPlans, selectedCompanyBoundary]);

  const selectedCompanyAssetCount = useMemo(
    () =>
      selectedCompanyFloors.reduce(
        (total, floorPlan) => total + (Array.isArray(floorPlan.transformerIds) ? floorPlan.transformerIds.length : 0),
        0
      ),
    [selectedCompanyFloors]
  );

  const selectedFloorTransformers = useMemo(
    () =>
      selectedFloorPlan
        ? selectedFloorPlan.transformerIds
            .map((transformerId) => transformers.find((transformer) => String(transformer.id) === String(transformerId)))
            .filter(Boolean)
        : [],
    [transformers, selectedFloorPlan]
  );

  const loadFloorPlans = async () => {
    try {
      await floorPlanService.migrateFromLocalStorage();
      const data = await floorPlanService.getAll();
      setFloorPlans(data);
    } catch (err) {
      console.error('Failed to load floor plans:', err);
    }
  };

  const handleOpenFloorDetail = useCallback((floorPlan) => {
    if (!floorPlan) return;
    setFloorDetailFloorPlanId(floorPlan.id);
    setIsFloorDetailModalOpen(true);
  }, []);

  const handleRemoveTransformerFromFloor = useCallback(async (floorPlanId, transformerId) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    const floorPlan = floorPlans.find((fp) => fp.id === floorPlanId);
    if (!floorPlan) return;
    const updatedIds = floorPlan.transformerIds.filter((id) => String(id) !== String(transformerId));
    try {
      await floorPlanService.updateTransformerIds(floorPlanId, updatedIds);
      setFloorPlans((prev) =>
        prev.map((fp) => fp.id === floorPlanId ? { ...fp, transformerIds: updatedIds } : fp)
      );
    } catch (err) {
      console.error('Failed to remove transformer from floor:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to update floor plan',
        description: 'The transformer assignment could not be updated yet.',
        detail: err?.message || 'Failed to update floor plan. Please try again.',
        contextLabel: 'Floor plan',
      });
    }
  }, [ensureCanEditAssets, floorPlans, showAppNotice]);

  const startFloorPlanDrawing = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setIsAddMode(false);
    cancelCompanyBoundaryDrawing();
    setSelectedCompanyBoundaryId(null);
    setSelectedFloorPlanId(null);
    setFloorPlanDraft(createDraftFloorPlan());
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
  };

  const handleEditFloorPlan = (floorPlan) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!floorPlan) {
      return;
    }

    focusFloorPlan(floorPlan);
    setIsAddMode(false);
    cancelCompanyBoundaryDrawing();
    setFloorPlanDraft(createDraftFloorPlan(floorPlan));
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
  };

  const handleSaveFloorPlanShape = async (floorPlan, nextPoints) => {
    if (!ensureCanEditAssets()) {
      return false;
    }
    if (!floorPlan || !Array.isArray(nextPoints) || nextPoints.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'A floor boundary needs at least three points before it can be saved.',
        detail: 'Add more points or continue reshaping the boundary, then try saving again.',
        contextLabel: 'Floor boundary',
        actionLabel: 'Back to map',
      });
      return false;
    }

    try {
      const normalizedFloorPlan = normalizeFloorPlan({
        ...floorPlan,
        points: nextPoints,
        createdAt: floorPlan.createdAt || new Date().toISOString(),
      });

      await floorPlanService.upsert(normalizedFloorPlan);
      const storedFloorPlans = await floorPlanService.getAll();
      setFloorPlans(storedFloorPlans);
      focusFloorPlan(normalizedFloorPlan);
      return true;
    } catch (err) {
      console.error('Failed to reshape floor plan:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save floor boundary',
        description: 'The reshaped floor boundary could not be saved yet.',
        detail: err?.message || 'Failed to save floor boundary. Please try again.',
        contextLabel: 'Floor boundary',
      });
      return false;
    }
  };

  const cancelFloorPlanDrawing = () => {
    setFloorPlanDraft(null);
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
  };

  const handleFloorDraftVertexMove = (pointIndex, nextPoint) => {
    if (!canEditAssets) {
      return;
    }
    setFloorPlanDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.map((point, index) => (index === pointIndex ? nextPoint : point)),
          }
        : current
    );
  };

  const handleUndoFloorDraftPoint = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setFloorPlanDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.slice(0, -1),
          }
        : current
    );
  };

  const openFloorPlanMetadataDialog = (draft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setFloorPlanDialogDraft(draft);
    setIsFloorPlanDialogOpen(true);
  };

  const handleEditFloorPlanInfo = (floorPlan) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!floorPlan) {
      return;
    }

    focusFloorPlan(floorPlan);
    setFloorPlanDraft(null);
    cancelCompanyBoundaryDrawing();
    openFloorPlanMetadataDialog({
      ...createDraftFloorPlan(floorPlan),
      points: floorPlan.points,
      detectedTransformerIds: floorPlan.transformerIds.map((transformerId) => String(transformerId)),
    });
  };

  const openFloorPlanDialogFromDraft = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!floorPlanDraft || floorPlanDraft.points.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'Draw at least three points on the map to create a floor boundary.',
        detail: 'Keep clicking on the map until the area has enough points to form a closed boundary.',
        contextLabel: 'Floor boundary',
        actionLabel: 'Back to map',
      });
      return;
    }

    const detectedTransformers = findTransformersInsidePolygon(transformers, floorPlanDraft.points);
    const existingFloorPlan = floorPlanDraft.id
      ? floorPlans.find((floorPlan) => floorPlan.id === floorPlanDraft.id) || null
      : null;
    const draftCentroid = getPolygonCentroid(floorPlanDraft.points);
    const containingCompanyBoundary = draftCentroid
      ? companyBoundaries.find((boundary) => isPointInsidePolygon(draftCentroid, boundary.points))
      : null;
    const primaryTransformer =
      detectedTransformers[0] ||
      (existingFloorPlan?.transformerIds || [])
        .map((transformerId) =>
          transformers.find((transformer) => String(transformer.id) === String(transformerId))
        )
        .filter(Boolean)[0] ||
      selectedTransformer ||
      null;

    openFloorPlanMetadataDialog({
      ...createDraftFloorPlan({
        ...existingFloorPlan,
        ...floorPlanDraft,
        name: existingFloorPlan?.name || '',
        companyName: existingFloorPlan?.companyName || containingCompanyBoundary?.companyName || primaryTransformer?.siteName || '',
        state: existingFloorPlan?.state || containingCompanyBoundary?.state || (primaryTransformer ? getTransformerState(primaryTransformer) : '') || '',
        transformerIds:
          existingFloorPlan?.transformerIds?.length
            ? existingFloorPlan.transformerIds
            : detectedTransformers.map((transformer) => String(transformer.id)),
        }),
      detectedTransformerIds: detectedTransformers.map((transformer) => String(transformer.id)),
    });
  };

  const handleSaveFloorPlan = async (nextFloorPlanDraft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    try {
      const currentFloorPlan = nextFloorPlanDraft?.id
        ? floorPlans.find((floorPlan) => floorPlan.id === nextFloorPlanDraft.id) || null
        : null;
      const normalizedFloorPlan = normalizeFloorPlan({
        ...currentFloorPlan,
        ...nextFloorPlanDraft,
        createdAt: currentFloorPlan?.createdAt || nextFloorPlanDraft?.createdAt || new Date().toISOString(),
      });

      const assignedTransformerIds = new Set(
        normalizedFloorPlan.transformerIds.map((transformerId) => String(transformerId))
      );

      const stripUpdates = floorPlans
        .filter((plan) => plan.id !== normalizedFloorPlan.id)
        .filter((plan) => plan.transformerIds.some((tid) => assignedTransformerIds.has(String(tid))))
        .map((plan) =>
          floorPlanService.updateTransformerIds(
            plan.id,
            plan.transformerIds.filter((tid) => !assignedTransformerIds.has(String(tid)))
          )
        );

      await Promise.all([floorPlanService.upsert(normalizedFloorPlan), ...stripUpdates]);

      const storedFloorPlans = await floorPlanService.getAll();
      setFloorPlans(storedFloorPlans);
      setIsFloorPlanDialogOpen(false);
      setFloorPlanDialogDraft(null);
      setFloorPlanDraft(null);
      focusFloorPlan(normalizedFloorPlan);
    } catch (err) {
      console.error('Failed to save floor plan:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save floor plan',
        description: 'The floor plan record could not be saved yet.',
        detail: err?.message || 'Failed to save floor plan. Please try again.',
        contextLabel: 'Floor plan',
      });
    }
  };

  const handleDeleteFloorPlan = (floorPlanId) => {
    if (!ensureCanEditAssets()) {
      return;
    }

    const targetPlan = floorPlans.find((plan) => plan.id === floorPlanId);
    const planLabel = targetPlan?.name || targetPlan?.floorLabel || 'this floor';

    const runDelete = async () => {
      setConfirmBusy(true);
      try {
        await floorPlanService.delete(floorPlanId);
        setFloorPlans((current) => current.filter((plan) => plan.id !== floorPlanId));
        if (selectedFloorPlanId === floorPlanId) {
          setSelectedFloorPlanId(null);
        }
        if (floorPlanDraft?.id === floorPlanId) {
          setFloorPlanDraft(null);
        }
        setIsFloorPlanDialogOpen(false);
        setFloorPlanDialogDraft(null);
        setConfirmState(null);
      } catch (err) {
        console.error('Failed to delete floor plan:', err);
        setConfirmState(null);
        showAppNotice({
          variant: 'error',
          title: 'Unable to delete floor plan',
          description: 'The floor plan overlay could not be deleted yet.',
          detail: err?.message || 'Failed to delete floor plan. Please try again.',
          contextLabel: 'Floor plan',
        });
      } finally {
        setConfirmBusy(false);
      }
    };

    setConfirmState({
      title: `Delete ${planLabel}?`,
      description:
        'The transformer records stay, but they will be ungrouped from this floor.',
      confirmLabel: 'Delete floor',
      cancelLabel: 'Cancel',
      tone: 'danger',
      onConfirm: runDelete,
    });
  };

  return {
    floorPlans,
    setFloorPlans,
    showFloorPlans,
    setShowFloorPlans,
    floorPlanDraft,
    setFloorPlanDraft,
    isFloorPlanDialogOpen,
    setIsFloorPlanDialogOpen,
    floorPlanDialogDraft,
    setFloorPlanDialogDraft,
    floorDetailFloorPlanId,
    setFloorDetailFloorPlanId,
    isFloorDetailModalOpen,
    setIsFloorDetailModalOpen,
    floorPlanByTransformerId,
    floorDetailFloorPlan,
    selectedFloorPlan,
    selectedCompanyFloors,
    selectedCompanyAssetCount,
    selectedFloorTransformers,
    loadFloorPlans,
    handleOpenFloorDetail,
    handleRemoveTransformerFromFloor,
    startFloorPlanDrawing,
    handleEditFloorPlan,
    handleSaveFloorPlanShape,
    cancelFloorPlanDrawing,
    handleFloorDraftVertexMove,
    handleUndoFloorDraftPoint,
    openFloorPlanMetadataDialog,
    handleEditFloorPlanInfo,
    openFloorPlanDialogFromDraft,
    handleSaveFloorPlan,
    handleDeleteFloorPlan,
  };
}
