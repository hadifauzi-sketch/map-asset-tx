import React, { useEffect, useMemo, useState } from 'react';
import { oilTestService } from '../lib/oilTestService';
import DGAWorkbenchModal from './DGAWorkbenchModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { normaliseTestTypeForStorage, TEST_TYPE_OPTIONS } from '../lib/testTypeUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const DELETE_ALL_CONFIRM_PHRASE = 'DELETE ALL';

// DP estimation formulas
function calculateDpFromFuran(fal2) {
  const val = parseFloat(fal2);
  if (!val || val <= 0) return null;
    // DONG ET AL [2] . correlation: 402.47 - 220.87×log₁₀(2FAL)
  const dp = 402.47 - 220.87 * Math.log10(val);
  return dp > 0 ? Math.round(dp) : null;
}

function calculateDpFromMethanol(methanol) {
  const val = parseFloat(methanol);
  if (!val || val <= 0) return null;
  // Jalbert et al. correlation: log10(CH3OH) = -0.00283 × DP + 3.837 
  const dp = (3.837 - Math.log10(val)) / 0.00283;
  return dp > 0 ? Math.round(dp) : null;
}

function calculateTdcg(formData) {
  const gases = ['h2', 'ch4', 'c2h2', 'c2h4', 'c2h6', 'co'];
  const values = gases.map(g => parseFloat(formData[g]) || 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  return total > 0 ? total : null;
}

const TEST_DETAIL_SECTIONS = [
  {
    title: 'Physical & Chemical Tests',
    eyebrow: 'Fluid condition',
    metrics: [
      { key: 'breakdown', label: 'Breakdown Voltage', unit: 'kV' },
      { key: 'acidity', label: 'Acidity', unit: 'mgKOH/g' },
      { key: 'waterContent', label: 'Water Content', unit: 'ppm' },
      { key: 'interfacialTension', label: 'IFT', unit: 'mN/m' },
      { key: 'color', label: 'Color', unit: 'ASTM' },
      { key: 'flashPoint', label: 'Flash Point', unit: 'deg C' },
      { key: 'inhibitor', label: 'Inhibitor', unit: '%' },
      { key: 'copperCorrosive', label: 'Copper Corrosive IEC' },
      { key: 'density', label: 'Density', unit: 'kg/m3' },
      { key: 'dbds', label: 'DBDS', unit: 'mg/kg' },
      { key: 'viscosity40', label: 'Viscosity @40C', unit: 'cSt' },
      { key: 'methanol', label: 'Methanol', unit: 'ppm' },
      { key: 'pcb', label: 'PCB', unit: 'ppm' },
      { key: 'powerFactor', label: 'Power Factor' },
      { key: 'resistivity', label: 'Resistivity', unit: 'GOhm-m' },
      { key: 'specificGravity', label: 'Specific Gravity' },
      { key: 'passivator', label: 'Passivator', unit: 'ppm' },
    ],
  },
  {
    title: 'Dissolved Gas Analysis',
    eyebrow: 'Gas concentrations',
    metrics: [
      { key: 'h2', label: 'Hydrogen', unit: 'ppm' },
      { key: 'ch4', label: 'Methane', unit: 'ppm' },
      { key: 'c2h2', label: 'Acetylene', unit: 'ppm' },
      { key: 'c2h4', label: 'Ethylene', unit: 'ppm' },
      { key: 'c2h6', label: 'Ethane', unit: 'ppm' },
      { key: 'co', label: 'Carbon Monoxide', unit: 'ppm' },
      { key: 'co2', label: 'Carbon Dioxide', unit: 'ppm' },
      { key: 'o2', label: 'Oxygen', unit: 'ppm' },
      { key: 'n2', label: 'Nitrogen', unit: 'ppm' },
      { key: 'tdcg', label: 'TDCG', unit: 'ppm' },
    ],
  },
  {
    title: 'Furanic Compounds',
    eyebrow: 'Paper aging markers',
    metrics: [
      { key: 'fol2', label: '2-FOL', unit: 'ppb' },
      { key: 'hmf5', label: '5-HMF', unit: 'ppb' },
      { key: 'fal2', label: '2-FAL', unit: 'ppb' },
      { key: 'acf2', label: '2-ACF', unit: 'ppb' },
      { key: 'mef5', label: '5-MEF', unit: 'ppb' },
    ],
  },
  {
    title: 'Metals in Oil',
    eyebrow: 'Wear and contamination',
    metrics: [
      { key: 'copperCu', label: 'Copper (Cu)', unit: 'ppm' },
      { key: 'ironFe', label: 'Iron (Fe)', unit: 'ppm' },
      { key: 'aluminumAl', label: 'Aluminum (Al)', unit: 'ppm' },
    ],
  },
  {
    title: 'Estimated DP',
    eyebrow: 'Derived indicators',
    metrics: [
      { key: 'estimatedDpFuran', label: 'DP from Furan (2-FAL)' },
      { key: 'estimatedDpMethanol', label: 'DP from Methanol' },
    ],
  },
];

function hasResultValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function getResultValue(value) {
  return hasResultValue(value) ? String(value) : '-';
}

function OilTestSection({
  transformerId,
  oilTests,
  onUpdate,
  transformer,
  activeCompartment = 'Maintank',
  onAssignCompartment,
}) {
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [expandedTests, setExpandedTests] = useState({});
  const [viewingTest, setViewingTest] = useState(null);
  const [dgaTest, setDgaTest] = useState(null);
  const [dgaPreferencesOverride, setDgaPreferencesOverride] = useState(null);
  const [pendingDeleteTest, setPendingDeleteTest] = useState(null);
  const [isDeletingTest, setIsDeletingTest] = useState(false);
  const [pendingDeleteAllTestIds, setPendingDeleteAllTestIds] = useState([]);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [isDeletingAllTests, setIsDeletingAllTests] = useState(false);
  const [formData, setFormData] = useState({
    testDate: new Date().toISOString().split('T')[0],
    testType: 'Routine',
    // Physical & Chemical Tests
    breakdown: '',
    acidity: '',
    waterContent: '',
    interfacialTension: '',
    color: '',
    flashPoint: '',
    inhibitor: '',
    copperCorrosive: '',
    density: '',
    dbds: '',
    viscosity40: '',
    methanol: '',
    pcb: '',
    powerFactor: '',
    resistivity: '',
    specificGravity: '',
    passivator: '',
    // DGA
    h2: '',
    ch4: '',
    c2h2: '',
    c2h4: '',
    c2h6: '',
    co: '',
    co2: '',
    o2: '',
    n2: '',
    tdcg: '',
    // Furanic Compounds
    fol2: '',
    hmf5: '',
    fal2: '',
    acf2: '',
    mef5: '',
    // Metals-in-Oil
    copperCu: '',
    ironFe: '',
    aluminumAl: '',
    // Estimate DP
    estimatedDpFuran: '',
    estimatedDpMethanol: '',
    notes: '',
  });

  useEffect(() => {
    setDgaPreferencesOverride(null);
  }, [transformer?.id]);

  const transformerForWorkbench = useMemo(() => {
    if (!transformer || !dgaPreferencesOverride) {
      return transformer;
    }

    return {
      ...transformer,
      ...dgaPreferencesOverride,
    };
  }, [dgaPreferencesOverride, transformer]);

  // Auto-calculate TDCG and DP estimates when relevant fields change
  const computedTdcg = useMemo(() => calculateTdcg(formData), [formData.h2, formData.ch4, formData.c2h2, formData.c2h4, formData.c2h6, formData.co]);
  const computedDpFuran = useMemo(() => calculateDpFromFuran(formData.fal2), [formData.fal2]);
  const computedDpMethanol = useMemo(() => calculateDpFromMethanol(formData.methanol), [formData.methanol]);

  const handleAddTest = () => {
    setIsAddingTest(true);
    setEditingTest(null);
    setFormData({
      testDate: new Date().toISOString().split('T')[0],
      testType: 'Routine',
      breakdown: '',
      acidity: '',
      waterContent: '',
      interfacialTension: '',
      color: '',
      flashPoint: '',
      inhibitor: '',
      copperCorrosive: '',
      density: '',
      dbds: '',
      viscosity40: '',
      methanol: '',
      pcb: '',
      powerFactor: '',
      resistivity: '',
      specificGravity: '',
      passivator: '',
      h2: '',
      ch4: '',
      c2h2: '',
      c2h4: '',
      c2h6: '',
      co: '',
      co2: '',
      o2: '',
      n2: '',
      tdcg: '',
      fol2: '',
      hmf5: '',
      fal2: '',
      acf2: '',
      mef5: '',
      copperCu: '',
      ironFe: '',
      aluminumAl: '',
      estimatedDpFuran: '',
      estimatedDpMethanol: '',
      notes: '',
    });
  };

  const handleEditTest = (test) => {
    setEditingTest(test);
    setIsAddingTest(true);
    setFormData({
      ...test,
      testType: normaliseTestTypeForStorage(test?.testType),
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Include auto-calculated values in the submission
    const submitData = {
      ...formData,
      tdcg: computedTdcg || formData.tdcg || null,
      estimatedDpFuran: computedDpFuran || formData.estimatedDpFuran || null,
      estimatedDpMethanol: computedDpMethanol || formData.estimatedDpMethanol || null,
    };
    
    try {
      let changedTestId = null;

      if (editingTest && editingTest.id) {
        // Update existing test in Supabase
        await oilTestService.update(editingTest.id, submitData);
        changedTestId = editingTest.id;
      } else {
        // Create new test in Supabase
        const createdTest = await oilTestService.create(transformerId, submitData);
        changedTestId = createdTest?.id || null;
      }

      if (changedTestId && onAssignCompartment) {
        onAssignCompartment(changedTestId, activeCompartment);
      }
      
      // Reload tests from database
      const updatedTests = await oilTestService.getByTransformerId(transformerId);
      onUpdate(transformerId, updatedTests);
      
      setIsAddingTest(false);
      setEditingTest(null);
    } catch (error) {
      console.error('Error saving oil test:', error);
      alert('Failed to save oil test. Please try again.');
    }
  };

  const handleRequestDeleteTest = (test) => {
    if (!test) {
      return;
    }

    setPendingDeleteTest(test);
  };

  const closeDeleteTestDialog = () => {
    if (isDeletingTest) {
      return;
    }

    setPendingDeleteTest(null);
  };

  const handleDeleteTest = async () => {
    if (!pendingDeleteTest?.id || isDeletingTest) {
      return;
    }

    setIsDeletingTest(true);

    try {
      await oilTestService.delete(pendingDeleteTest.id);

      // Reload tests from database
      const updatedTests = await oilTestService.getByTransformerId(transformerId);
      onUpdate(transformerId, updatedTests);
      setPendingDeleteTest(null);
    } catch (error) {
      console.error('Error deleting oil test:', error);
      alert('Failed to delete oil test. Please try again.');
    } finally {
      setIsDeletingTest(false);
    }
  };

  const handleRequestDeleteAllTests = () => {
    if (isDeletingAllTests || isDeletingTest || oilTests.length === 0) {
      return;
    }

    const testIds = oilTests.map((test) => test?.id).filter((id) => id !== null && id !== undefined);
    setPendingDeleteAllTestIds(testIds);
    setDeleteAllConfirmText('');
  };

  const closeDeleteAllDialog = (forceClose = false) => {
    if (isDeletingAllTests && !forceClose) {
      return;
    }

    setPendingDeleteAllTestIds([]);
    setDeleteAllConfirmText('');
  };

  const handleDeleteAllTests = async () => {
    const isConfirmed = deleteAllConfirmText.trim() === DELETE_ALL_CONFIRM_PHRASE;

    if (!isConfirmed || pendingDeleteAllTestIds.length === 0 || isDeletingAllTests) {
      return;
    }

    setIsDeletingAllTests(true);

    try {
      await oilTestService.deleteMany(pendingDeleteAllTestIds);
      const updatedTests = await oilTestService.getByTransformerId(transformerId);
      onUpdate(transformerId, updatedTests);
      closeDeleteAllDialog(true);
    } catch (error) {
      console.error('Error deleting all oil tests:', error);
      alert('Failed to delete all oil test records. Please try again.');
    } finally {
      setIsDeletingAllTests(false);
    }
  };

  const handleCancel = () => {
    setIsAddingTest(false);
    setEditingTest(null);
  };

  const toggleExpand = (testId) => {
    setExpandedTests(prev => ({ ...prev, [testId]: !prev[testId] }));
  };

  // Helper to get a compact summary of key test values
  const getTestSummary = (test) => {
    const items = [];
    if (test.breakdown) items.push({ label: 'BDV', value: `${test.breakdown} kV` });
    if (test.acidity) items.push({ label: 'Acidity', value: `${test.acidity}` });
    if (test.waterContent) items.push({ label: 'Water', value: `${test.waterContent} ppm` });
    if (test.h2) items.push({ label: 'H₂', value: `${test.h2}` });
    if (test.co) items.push({ label: 'CO', value: `${test.co}` });
    if (test.tdcg) items.push({ label: 'TDCG', value: `${test.tdcg}` });
    if (test.fal2) items.push({ label: '2-FAL', value: `${test.fal2}` });
    if (test.estimatedDpFuran) items.push({ label: 'DP(FAL)', value: `${test.estimatedDpFuran}` });
    return items.slice(0, 6); // Show max 6 key values
  };

  // Render full test detail (reused in both collapse and modal)
  const legacyRenderTestDetails = (test) => (
    <div className="test-results">
      <div className="result-section">
        <h4>Physical & Chemical Tests</h4>
        <div className="result-grid">
          <div className="result-item">
            <span className="result-label">Breakdown Voltage (kV)</span>
            <span className="result-value">{test.breakdown || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Acidity (mgKOH/g)</span>
            <span className="result-value">{test.acidity || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Water Content (ppm)</span>
            <span className="result-value">{test.waterContent || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">IFT (mN/m)</span>
            <span className="result-value">{test.interfacialTension || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Color (ASTM)</span>
            <span className="result-value">{test.color || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Flash Point (°C)</span>
            <span className="result-value">{test.flashPoint || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Inhibitor (%)</span>
            <span className="result-value">{test.inhibitor || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Copper Corrosive IEC</span>
            <span className="result-value">{test.copperCorrosive || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Density (kg/m³)</span>
            <span className="result-value">{test.density || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">DBDS (mg/kg)</span>
            <span className="result-value">{test.dbds || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Viscosity @40°C (cSt)</span>
            <span className="result-value">{test.viscosity40 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Methanol (ppm)</span>
            <span className="result-value">{test.methanol || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">PCB (ppm)</span>
            <span className="result-value">{test.pcb || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Power Factor</span>
            <span className="result-value">{test.powerFactor || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Resistivity (GΩ·m)</span>
            <span className="result-value">{test.resistivity || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Specific Gravity</span>
            <span className="result-value">{test.specificGravity || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Passivator (ppm)</span>
            <span className="result-value">{test.passivator || '-'}</span>
          </div>
        </div>
      </div>

      <div className="result-section">
        <h4>Dissolved Gas Analysis (DGA)</h4>
        <div className="result-grid">
          <div className="result-item">
            <span className="result-label">Hydrogen - H₂ (ppm)</span>
            <span className="result-value">{test.h2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Methane - CH₄ (ppm)</span>
            <span className="result-value">{test.ch4 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Acetylene - C₂H₂ (ppm)</span>
            <span className="result-value">{test.c2h2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Ethylene - C₂H₄ (ppm)</span>
            <span className="result-value">{test.c2h4 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Ethane - C₂H₆ (ppm)</span>
            <span className="result-value">{test.c2h6 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Carbon Monoxide - CO (ppm)</span>
            <span className="result-value">{test.co || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Carbon Dioxide - CO₂ (ppm)</span>
            <span className="result-value">{test.co2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Oxygen - O₂ (ppm)</span>
            <span className="result-value">{test.o2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Nitrogen - N₂ (ppm)</span>
            <span className="result-value">{test.n2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">TDCG (ppm)</span>
            <span className="result-value">{test.tdcg || '-'}</span>
          </div>
        </div>
      </div>

      <div className="result-section">
        <h4>Furanic Compounds</h4>
        <div className="result-grid">
          <div className="result-item">
            <span className="result-label">2-FOL (ppb)</span>
            <span className="result-value">{test.fol2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">5-HMF (ppb)</span>
            <span className="result-value">{test.hmf5 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">2-FAL (ppb)</span>
            <span className="result-value">{test.fal2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">2-ACF (ppb)</span>
            <span className="result-value">{test.acf2 || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">5-MEF (ppb)</span>
            <span className="result-value">{test.mef5 || '-'}</span>
          </div>
        </div>
      </div>

      <div className="result-section">
        <h4>Metals-in-Oil</h4>
        <div className="result-grid">
          <div className="result-item">
            <span className="result-label">Copper - Cu (ppm)</span>
            <span className="result-value">{test.copperCu || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Iron - Fe (ppm)</span>
            <span className="result-value">{test.ironFe || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Aluminum - Al (ppm)</span>
            <span className="result-value">{test.aluminumAl || '-'}</span>
          </div>
        </div>
      </div>

      <div className="result-section">
        <h4>Estimate DP</h4>
        <div className="result-grid">
          <div className="result-item">
            <span className="result-label">DP from Furan (2-FAL)</span>
            <span className="result-value">{test.estimatedDpFuran || '-'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">DP from Methanol</span>
            <span className="result-value">{test.estimatedDpMethanol || '-'}</span>
          </div>
        </div>
      </div>

      <div className="result-section">
        <h4>Assessment</h4>
        <p className="test-notes">{test.notes || 'No assessment recorded.'}</p>
      </div>
    </div>
  );

  const renderTestDetails = (test) => {
    const overviewMetrics = [
      { label: 'Breakdown Voltage', value: test.breakdown, unit: 'kV' },
      { label: 'Water Content', value: test.waterContent, unit: 'ppm' },
      { label: 'TDCG', value: test.tdcg, unit: 'ppm' },
      {
        label: 'DP Estimate',
        value: hasResultValue(test.estimatedDpFuran) ? test.estimatedDpFuran : test.estimatedDpMethanol,
      },
    ];

    return (
      <div className="test-results">
        <section className="result-section result-section-notes">
          <div className="result-section-header">
            <div>
              <h4>Assessment</h4>
            </div>
          </div>
          <p className="test-notes">{test.notes || 'No assessment recorded for this sample.'}</p>
        </section>

        <div className="test-overview-grid">
          {overviewMetrics.map((metric) => (
            <div key={metric.label} className="test-overview-card">
              <span className="test-overview-label">{metric.label}</span>
              <div className="test-overview-value-row">
                <span className="test-overview-value">{getResultValue(metric.value)}</span>
                {metric.unit ? <span className="test-overview-unit">{metric.unit}</span> : null}
              </div>
            </div>
          ))}
        </div>

        {TEST_DETAIL_SECTIONS.map((section) => {
          const completedCount = section.metrics.filter((metric) => hasResultValue(test[metric.key])).length;

          return (
            <section key={section.title} className="result-section">
              <div className="result-section-header">
                <div>
                  <p className="result-section-eyebrow">{section.eyebrow}</p>
                  <h4>{section.title}</h4>
                </div>
                <span className="result-section-count">
                  {completedCount}/{section.metrics.length}
                </span>
              </div>

              <div className="result-grid">
                {section.metrics.map((metric) => (
                  <div key={metric.key} className="result-item">
                    <div className="result-meta">
                      <span className="result-label">{metric.label}</span>
                      {metric.unit ? <span className="result-unit">{metric.unit}</span> : null}
                    </div>
                    <span className="result-value">{getResultValue(test[metric.key])}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="oil-test-section">
      {/* View Test Modal */}
      {viewingTest && (
        <div className="test-view-overlay" onClick={() => setViewingTest(null)}>
          <div className="test-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="test-view-header">
              <div className="test-view-title">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2h6V3M7 7h10v10a2 2 0 01-2 2h-6a2 2 0 01-2-2V7z" />
                </svg>
                <div className="test-view-heading">
                  <div className="test-view-heading-main">
                    <h3>Oil Test Result</h3>
                    <span className="test-type-badge">{normaliseTestTypeForStorage(viewingTest.testType)}</span>
                    <span className="test-view-date">
                      Sampled {new Date(viewingTest.testDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {transformer ? (
                    <p className="test-view-subtitle">
                      {transformer.txName || 'Transformer'}
                      {transformer.siteName ? ` | ${transformer.siteName}` : ''}
                      {transformer.serialNumber ? ` | ${transformer.serialNumber}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              <button className="close-btn" onClick={() => setViewingTest(null)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="test-view-body">
              {renderTestDetails(viewingTest)}
            </div>
          </div>
        </div>
      )}

      {/* DGA Analysis Fullscreen Modal */}
      {dgaTest && (
        <div className="heptagon-fullscreen-overlay" onClick={() => setDgaTest(null)}>
          <div className="heptagon-fullscreen-modal" onClick={(e) => e.stopPropagation()}>
            <div className="heptagon-fullscreen-header">
              <div className="heptagon-fullscreen-title">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3>DGA Analysis</h3>
                <span className="test-type-badge">{normaliseTestTypeForStorage(dgaTest.testType)}</span>
                <span className="test-view-date">
                  📅 {new Date(dgaTest.testDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <button className="close-btn" onClick={() => setDgaTest(null)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="heptagon-fullscreen-body">
              <DGAWorkbenchModal
                transformer={transformerForWorkbench}
                oilTests={oilTests}
                selectedTestId={dgaTest.id}
                onPreferencesSaved={(preferences) => {
                  setDgaPreferencesOverride(preferences);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(pendingDeleteTest)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDeleteTestDialog();
          }
        }}
      >
        <DialogContent className="max-w-[460px]" showClose={!isDeletingTest}>
          <DialogHeader>
            <DialogTitle>Delete oil test record?</DialogTitle>
            <DialogDescription className="leading-6">
              {pendingDeleteTest?.testDate ? (
                <>
                  This will permanently remove the oil test sampled on{' '}
                  <span className="font-semibold text-[var(--foreground)]">
                    {new Date(pendingDeleteTest.testDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  {pendingDeleteTest?.testType ? ` (${normaliseTestTypeForStorage(pendingDeleteTest.testType)})` : ''}.
                </>
              ) : (
                'This will permanently remove the selected oil test record.'
              )}{' '}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteTestDialog} disabled={isDeletingTest}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTest} disabled={isDeletingTest}>
              {isDeletingTest ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteAllTestIds.length > 0}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDeleteAllDialog();
          }
        }}
      >
        <DialogContent className="max-w-[520px]" showClose={!isDeletingAllTests}>
          <DialogHeader>
            <DialogTitle>Delete all oil test records?</DialogTitle>
            <DialogDescription className="leading-6">
              This will permanently remove{' '}
              <span className="font-semibold text-[var(--foreground)]">
                {pendingDeleteAllTestIds.length} oil test record{pendingDeleteAllTestIds.length === 1 ? '' : 's'}
              </span>{' '}
              from{' '}
              <span className="font-semibold text-[var(--foreground)]">{activeCompartment}</span>. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-5 py-4">
            <label htmlFor="delete-all-confirm" className="text-sm font-medium text-[var(--foreground)]">
              Type <span className="font-bold">{DELETE_ALL_CONFIRM_PHRASE}</span> to confirm
            </label>
            <Input
              id="delete-all-confirm"
              value={deleteAllConfirmText}
              onChange={(event) => setDeleteAllConfirmText(event.target.value)}
              placeholder={DELETE_ALL_CONFIRM_PHRASE}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={isDeletingAllTests}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteAllDialog} disabled={isDeletingAllTests}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllTests}
              disabled={isDeletingAllTests || deleteAllConfirmText.trim() !== DELETE_ALL_CONFIRM_PHRASE}
            >
              {isDeletingAllTests ? 'Deleting...' : 'Delete all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isAddingTest ? (
        <>
          <div className="section-header">
            <div className="flex items-center gap-2">
              <h3>Oil Test Records</h3>
              <span className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-2 py-1 text-xs font-medium text-[var(--muted)]">
                {activeCompartment}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRequestDeleteAllTests}
                disabled={oilTests.length === 0 || isDeletingAllTests || isDeletingTest}
              >
                Delete all
              </Button>
              <button
                className="btn-add-small"
                onClick={handleAddTest}
                disabled={isDeletingAllTests || isDeletingTest}
              >
                + Add Test Record
              </button>
            </div>
          </div>

          {oilTests.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No oil test records yet</p>
              <button className="btn-add-empty" onClick={handleAddTest}>
                Add First Test Record
              </button>
            </div>
          ) : (
            <div className="test-list">
              {oilTests.map((test) => (
                <div key={test.id} className={`test-card ${expandedTests[test.id] ? 'expanded' : ''}`}>
                  {/* Compact header - click to expand/collapse */}
                  <div className="test-card-header" onClick={() => toggleExpand(test.id)}>
                    <div className="test-card-left">
                      <span className={`expand-arrow ${expandedTests[test.id] ? 'expanded' : ''}`}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                      <span className="date-icon">📅</span>
                      <span className="test-card-date">
                        {new Date(test.testDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="test-type-badge">{normaliseTestTypeForStorage(test.testType)}</span>
                    </div>
                    <div className="test-card-summary">
                      {getTestSummary(test).map((item, i) => (
                        <span key={i} className="summary-chip">
                          <span className="summary-chip-label">{item.label}</span>
                          <span className="summary-chip-value">{item.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="test-card-actions">
                    <button 
                      className="btn-action-view"
                      onClick={(e) => { e.stopPropagation(); setViewingTest(test); }}
                      title="View full test details"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </button>
                    <button
                      className="btn-action-analysis"
                      onClick={(e) => { e.stopPropagation(); setDgaTest(test); }}
                      title="DGA Analysis (Duval + Heptagon + Assessment)"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      DGA Analysis
                    </button>
                    <button 
                      className="btn-edit-small"
                      onClick={(e) => { e.stopPropagation(); handleEditTest(test); }}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-delete-small"
                      onClick={(e) => { e.stopPropagation(); handleRequestDeleteTest(test); }}
                      disabled={isDeletingTest || isDeletingAllTests}
                    >
                      Delete
                    </button>
                  </div>

                  {/* Collapsible detail section */}
                  {expandedTests[test.id] && (
                    <div className="test-card-body">
                      {renderTestDetails(test)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="test-form">
          <div className="form-header">
            <h3>{editingTest ? 'Edit Test Record' : 'Add Test Record'}</h3>
            <p className="text-sm text-[var(--muted)]">Compartment: {activeCompartment}</p>
          </div>

          <div className="form-section">
            <h4>Test Information</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="testDate">Test Date *</label>
                <input
                  type="date"
                  id="testDate"
                  name="testDate"
                  value={formData.testDate}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="testType">Test Type *</label>
                <select
                  id="testType"
                  name="testType"
                  value={formData.testType}
                  onChange={handleChange}
                  required
                >
                  {TEST_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Physical & Chemical Tests</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="breakdown">Breakdown Voltage (kV)</label>
                <input
                  type="number"
                  step="0.1"
                  id="breakdown"
                  name="breakdown"
                  value={formData.breakdown}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="form-group">
                <label htmlFor="acidity">Acidity (mgKOH/g)</label>
                <input
                  type="number"
                  step="0.01"
                  id="acidity"
                  name="acidity"
                  value={formData.acidity}
                  onChange={handleChange}
                  placeholder="e.g., 0.15"
                />
              </div>
              <div className="form-group">
                <label htmlFor="waterContent">Water Content (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  id="waterContent"
                  name="waterContent"
                  value={formData.waterContent}
                  onChange={handleChange}
                  placeholder="e.g., 25"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="interfacialTension">IFT (mN/m)</label>
                <input
                  type="number"
                  step="0.1"
                  id="interfacialTension"
                  name="interfacialTension"
                  value={formData.interfacialTension}
                  onChange={handleChange}
                  placeholder="e.g., 35"
                />
              </div>
              <div className="form-group">
                <label htmlFor="color">Color (ASTM)</label>
                <input
                  type="text"
                  id="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  placeholder="e.g., L0.5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="flashPoint">Flash Point (°C)</label>
                <input
                  type="number"
                  step="1"
                  id="flashPoint"
                  name="flashPoint"
                  value={formData.flashPoint}
                  onChange={handleChange}
                  placeholder="e.g., 145"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="inhibitor">Inhibitor (%)</label>
                <input
                  type="number"
                  step="0.01"
                  id="inhibitor"
                  name="inhibitor"
                  value={formData.inhibitor}
                  onChange={handleChange}
                  placeholder="e.g., 0.3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="copperCorrosive">Copper Corrosive IEC</label>
                <input
                  type="text"
                  id="copperCorrosive"
                  name="copperCorrosive"
                  value={formData.copperCorrosive}
                  onChange={handleChange}
                  placeholder="e.g., 1a"
                />
              </div>
              <div className="form-group">
                <label htmlFor="density">Density (kg/m³)</label>
                <input
                  type="number"
                  step="0.001"
                  id="density"
                  name="density"
                  value={formData.density}
                  onChange={handleChange}
                  placeholder="e.g., 0.895"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dbds">DBDS (mg/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  id="dbds"
                  name="dbds"
                  value={formData.dbds}
                  onChange={handleChange}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="viscosity40">Viscosity @40°C (cSt)</label>
                <input
                  type="number"
                  step="0.01"
                  id="viscosity40"
                  name="viscosity40"
                  value={formData.viscosity40}
                  onChange={handleChange}
                  placeholder="e.g., 9.5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="methanol">Methanol (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  id="methanol"
                  name="methanol"
                  value={formData.methanol}
                  onChange={handleChange}
                  placeholder="e.g., 10"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pcb">PCB (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  id="pcb"
                  name="pcb"
                  value={formData.pcb}
                  onChange={handleChange}
                  placeholder="e.g., 2"
                />
              </div>
              <div className="form-group">
                <label htmlFor="powerFactor">Power Factor</label>
                <input
                  type="number"
                  step="0.001"
                  id="powerFactor"
                  name="powerFactor"
                  value={formData.powerFactor}
                  onChange={handleChange}
                  placeholder="e.g., 0.05"
                />
              </div>
              <div className="form-group">
                <label htmlFor="resistivity">Resistivity (GΩ·m)</label>
                <input
                  type="number"
                  step="0.1"
                  id="resistivity"
                  name="resistivity"
                  value={formData.resistivity}
                  onChange={handleChange}
                  placeholder="e.g., 60"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="specificGravity">Specific Gravity</label>
                <input
                  type="number"
                  step="0.001"
                  id="specificGravity"
                  name="specificGravity"
                  value={formData.specificGravity}
                  onChange={handleChange}
                  placeholder="e.g., 0.89"
                />
              </div>
              <div className="form-group">
                <label htmlFor="passivator">Passivator (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="passivator"
                  name="passivator"
                  value={formData.passivator}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Dissolved Gas Analysis (DGA)</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="h2">Hydrogen - H₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="h2"
                  name="h2"
                  value={formData.h2}
                  onChange={handleChange}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="form-group">
                <label htmlFor="ch4">Methane - CH₄ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="ch4"
                  name="ch4"
                  value={formData.ch4}
                  onChange={handleChange}
                  placeholder="e.g., 30"
                />
              </div>
              <div className="form-group">
                <label htmlFor="c2h2">Acetylene - C₂H₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="c2h2"
                  name="c2h2"
                  value={formData.c2h2}
                  onChange={handleChange}
                  placeholder="e.g., 2"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="c2h4">Ethylene - C₂H₄ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="c2h4"
                  name="c2h4"
                  value={formData.c2h4}
                  onChange={handleChange}
                  placeholder="e.g., 5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="c2h6">Ethane - C₂H₆ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="c2h6"
                  name="c2h6"
                  value={formData.c2h6}
                  onChange={handleChange}
                  placeholder="e.g., 10"
                />
              </div>
              <div className="form-group">
                <label htmlFor="co">Carbon Monoxide - CO (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="co"
                  name="co"
                  value={formData.co}
                  onChange={handleChange}
                  placeholder="e.g., 500"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="co2">Carbon Dioxide - CO₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="co2"
                  name="co2"
                  value={formData.co2}
                  onChange={handleChange}
                  placeholder="e.g., 2000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="o2">Oxygen - O₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="o2"
                  name="o2"
                  value={formData.o2}
                  onChange={handleChange}
                  placeholder="e.g., 20000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="n2">Nitrogen - N₂ (ppm)</label>
                <input
                  type="number"
                  step="1"
                  id="n2"
                  name="n2"
                  value={formData.n2}
                  onChange={handleChange}
                  placeholder="e.g., 50000"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>TDCG - Total Dissolved Combustible Gas (ppm)</label>
                <input
                  type="number"
                  value={computedTdcg || ''}
                  readOnly
                  className="computed-field"
                  placeholder="Auto-calculated from H₂+CH₄+C₂H₂+C₂H₄+C₂H₆+CO"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Furanic Compounds</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fol2">2-FOL (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="fol2"
                  name="fol2"
                  value={formData.fol2}
                  onChange={handleChange}
                  placeholder="e.g., 0.05"
                />
              </div>
              <div className="form-group">
                <label htmlFor="hmf5">5-HMF (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="hmf5"
                  name="hmf5"
                  value={formData.hmf5}
                  onChange={handleChange}
                  placeholder="e.g., 0.02"
                />
              </div>
              <div className="form-group">
                <label htmlFor="fal2">2-FAL (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="fal2"
                  name="fal2"
                  value={formData.fal2}
                  onChange={handleChange}
                  placeholder="e.g., 0.1"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="acf2">2-ACF (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="acf2"
                  name="acf2"
                  value={formData.acf2}
                  onChange={handleChange}
                  placeholder="e.g., 0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="mef5">5-MEF (ppb)</label>
                <input
                  type="number"
                  step="0.001"
                  id="mef5"
                  name="mef5"
                  value={formData.mef5}
                  onChange={handleChange}
                  placeholder="e.g., 0.01"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Metals-in-Oil</h4>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="copperCu">Copper - Cu (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="copperCu"
                  name="copperCu"
                  value={formData.copperCu}
                  onChange={handleChange}
                  placeholder="e.g., 0.5"
                />
              </div>
              <div className="form-group">
                <label htmlFor="ironFe">Iron - Fe (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="ironFe"
                  name="ironFe"
                  value={formData.ironFe}
                  onChange={handleChange}
                  placeholder="e.g., 1.0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="aluminumAl">Aluminum - Al (ppm)</label>
                <input
                  type="number"
                  step="0.01"
                  id="aluminumAl"
                  name="aluminumAl"
                  value={formData.aluminumAl}
                  onChange={handleChange}
                  placeholder="e.g., 0.3"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Estimate DP (Degree of Polymerization)</h4>
            <div className="form-row">
              <div className="form-group">
                <label>DP from Furan (2-FAL)</label>
                <input
                  type="number"
                  value={computedDpFuran || ''}
                  readOnly
                  className="computed-field"
                  placeholder="Auto-calculated from 2-FAL value"
                />
                <small className="field-hint">Chendong et al. equation</small>
              </div>
              <div className="form-group">
                <label>DP from Methanol</label>
                <input
                  type="number"
                  value={computedDpMethanol || ''}
                  readOnly
                  className="computed-field"
                  placeholder="Auto-calculated from Methanol value"
                />
                <small className="field-hint">Jalbert et al. correlation</small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>Additional Notes</h4>
            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                placeholder="Add any additional observations or comments..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-save">
              {editingTest ? 'Update Test' : 'Save Test'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default OilTestSection;
