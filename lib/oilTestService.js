import { supabase } from '../lib/supabaseClient';
import { normaliseTestTypeForStorage } from './testTypeUtils';
import { normaliseOilTypeForStorage } from './oilTypeUtils';

/**
 * Oil Test Database Service
 * Handles all CRUD operations for oil tests
 */

/**
 * Coerce a reading into a number for storage, keeping a genuine zero.
 *
 * Every numeric column used to be written as `testData.field || null`, which
 * silently discarded 0 because it is falsy. Labs report a gas below the
 * detection limit as "NIL", which the importers correctly parse to 0 — and that
 * 0 was then dropped on the way into the table, so an acetylene-free sample was
 * stored as "not measured" instead of "none detected". For C2H2 those two mean
 * opposite things in a DGA diagnosis, so the distinction has to survive.
 */
function numericOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** Blank text stays null; unlike numbers, an empty string carries no reading. */
function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

/**
 * Column mapping for `oil_tests`, shared by create() and update() so the two can
 * never drift apart on which fields they write or how they coerce them.
 */
export function buildOilTestRow(testData) {
  return {
    test_date: testData.testDate,
    test_type: normaliseTestTypeForStorage(testData.testType),
    oil_type: normaliseOilTypeForStorage(testData.oilType),
    // Physical & Chemical Tests
    breakdown: numericOrNull(testData.breakdown),
    acidity: numericOrNull(testData.acidity),
    water_content: numericOrNull(testData.waterContent),
    water_content_temperature: numericOrNull(testData.waterContentTemperature),
    water_content_basis: textOrNull(testData.waterContentBasis),
    interfacial_tension: numericOrNull(testData.interfacialTension),
    appearance: textOrNull(testData.appearance),
    color: textOrNull(testData.color),
    flash_point: numericOrNull(testData.flashPoint),
    inhibitor: numericOrNull(testData.inhibitor),
    copper_corrosive: textOrNull(testData.copperCorrosive),
    density: numericOrNull(testData.density),
    dbds: numericOrNull(testData.dbds),
    viscosity_40: numericOrNull(testData.viscosity40),
    methanol: numericOrNull(testData.methanol),
    ethanol: numericOrNull(testData.ethanol),
    pcb: numericOrNull(testData.pcb),
    power_factor: numericOrNull(testData.powerFactor),
    resistivity: numericOrNull(testData.resistivity),
    specific_gravity: numericOrNull(testData.specificGravity),
    passivator: numericOrNull(testData.passivator),
    // DGA
    h2: numericOrNull(testData.h2),
    ch4: numericOrNull(testData.ch4),
    c2h2: numericOrNull(testData.c2h2),
    c2h4: numericOrNull(testData.c2h4),
    c2h6: numericOrNull(testData.c2h6),
    co: numericOrNull(testData.co),
    co2: numericOrNull(testData.co2),
    o2: numericOrNull(testData.o2),
    n2: numericOrNull(testData.n2),
    tdcg: numericOrNull(testData.tdcg),
    // Furanic Compounds
    fol_2: numericOrNull(testData.fol2),
    hmf_5: numericOrNull(testData.hmf5),
    fal_2: numericOrNull(testData.fal2),
    acf_2: numericOrNull(testData.acf2),
    mef_5: numericOrNull(testData.mef5),
    // Metals-in-Oil
    copper_cu: numericOrNull(testData.copperCu),
    iron_fe: numericOrNull(testData.ironFe),
    aluminum_al: numericOrNull(testData.aluminumAl),
    // Estimate DP
    estimated_dp_furan: numericOrNull(testData.estimatedDpFuran),
    estimated_dp_methanol: numericOrNull(testData.estimatedDpMethanol),
    notes: textOrNull(testData.notes),
  };
}

export const oilTestService = {
  /**
   * Get all oil tests for a transformer
   */
  async getByTransformerId(transformerId) {
    try {
      const { data, error } = await supabase
        .from('oil_tests')
        .select('*')
        .eq('transformer_id', transformerId)
        .order('test_date', { ascending: false });

      if (error) throw error;

      return data.map(test => transformOilTest(test));
    } catch (error) {
      console.error('Error fetching oil tests:', error);
      throw error;
    }
  },

  /**
   * Create a new oil test
   */
  async create(transformerId, testData) {
    try {
      const { data, error } = await supabase
        .from('oil_tests')
        .insert([{ transformer_id: transformerId, ...buildOilTestRow(testData) }])
        .select()
        .single();

      if (error) throw error;

      return transformOilTest(data);
    } catch (error) {
      console.error('Error creating oil test:', error);
      throw error;
    }
  },

  /**
   * Update an oil test
   */
  async update(testId, testData) {
    try {
      const { data, error } = await supabase
        .from('oil_tests')
        .update(buildOilTestRow(testData))
        .eq('id', testId)
        .select()
        .single();

      if (error) throw error;

      return transformOilTest(data);
    } catch (error) {
      console.error('Error updating oil test:', error);
      throw error;
    }
  },

  /**
   * Delete an oil test
   */
  async delete(testId) {
    try {
      const { error } = await supabase
        .from('oil_tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting oil test:', error);
      throw error;
    }
  },

  /**
   * Delete multiple oil tests by ID
   */
  async deleteMany(testIds) {
    const ids = Array.isArray(testIds)
      ? Array.from(new Set(testIds.filter((id) => id !== null && id !== undefined)))
      : [];

    if (ids.length === 0) {
      return;
    }

    try {
      const { error } = await supabase
        .from('oil_tests')
        .delete()
        .in('id', ids);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting oil tests:', error);
      throw error;
    }
  }
};

/**
 * Helper function to transform oil test data from snake_case to camelCase
 */
function transformOilTest(test) {
  return {
    id: test.id,
    testDate: test.test_date,
    testType: normaliseTestTypeForStorage(test.test_type),
    oilType: normaliseOilTypeForStorage(test.oil_type),
    // Physical & Chemical Tests
    breakdown: test.breakdown,
    acidity: test.acidity,
    waterContent: test.water_content,
    waterContentTemperature: test.water_content_temperature,
    waterContentBasis: test.water_content_basis,
    interfacialTension: test.interfacial_tension,
    appearance: test.appearance,
    color: test.color,
    flashPoint: test.flash_point,
    inhibitor: test.inhibitor,
    copperCorrosive: test.copper_corrosive,
    density: test.density,
    dbds: test.dbds,
    viscosity40: test.viscosity_40,
    methanol: test.methanol,
    ethanol: test.ethanol,
    pcb: test.pcb,
    powerFactor: test.power_factor,
    resistivity: test.resistivity,
    specificGravity: test.specific_gravity,
    passivator: test.passivator,
    // DGA
    h2: test.h2,
    ch4: test.ch4,
    c2h2: test.c2h2,
    c2h4: test.c2h4,
    c2h6: test.c2h6,
    co: test.co,
    co2: test.co2,
    o2: test.o2,
    n2: test.n2,
    tdcg: test.tdcg,
    // Furanic Compounds
    fol2: test.fol_2,
    hmf5: test.hmf_5,
    fal2: test.fal_2,
    acf2: test.acf_2,
    mef5: test.mef_5,
    // Metals-in-Oil
    copperCu: test.copper_cu,
    ironFe: test.iron_fe,
    aluminumAl: test.aluminum_al,
    // Estimate DP
    estimatedDpFuran: test.estimated_dp_furan,
    estimatedDpMethanol: test.estimated_dp_methanol,
    notes: test.notes,
    createdAt: test.created_at
  };
}
