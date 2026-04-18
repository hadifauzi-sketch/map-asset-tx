import { supabase } from '../lib/supabaseClient';

/**
 * Oil Test Database Service
 * Handles all CRUD operations for oil tests
 */

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
        .insert([{
          transformer_id: transformerId,
          test_date: testData.testDate,
          test_type: testData.testType,
          // Physical & Chemical Tests
          breakdown: testData.breakdown || null,
          acidity: testData.acidity || null,
          water_content: testData.waterContent || null,
          interfacial_tension: testData.interfacialTension || null,
          color: testData.color || null,
          flash_point: testData.flashPoint || null,
          inhibitor: testData.inhibitor || null,
          copper_corrosive: testData.copperCorrosive || null,
          density: testData.density || null,
          dbds: testData.dbds || null,
          viscosity_40: testData.viscosity40 || null,
          methanol: testData.methanol || null,
          pcb: testData.pcb || null,
          power_factor: testData.powerFactor || null,
          resistivity: testData.resistivity || null,
          specific_gravity: testData.specificGravity || null,
          passivator: testData.passivator || null,
          // DGA
          h2: testData.h2 || null,
          ch4: testData.ch4 || null,
          c2h2: testData.c2h2 || null,
          c2h4: testData.c2h4 || null,
          c2h6: testData.c2h6 || null,
          co: testData.co || null,
          co2: testData.co2 || null,
          o2: testData.o2 || null,
          n2: testData.n2 || null,
          tdcg: testData.tdcg || null,
          // Furanic Compounds
          fol_2: testData.fol2 || null,
          hmf_5: testData.hmf5 || null,
          fal_2: testData.fal2 || null,
          acf_2: testData.acf2 || null,
          mef_5: testData.mef5 || null,
          // Metals-in-Oil
          copper_cu: testData.copperCu || null,
          iron_fe: testData.ironFe || null,
          aluminum_al: testData.aluminumAl || null,
          // Estimate DP
          estimated_dp_furan: testData.estimatedDpFuran || null,
          estimated_dp_methanol: testData.estimatedDpMethanol || null,
          notes: testData.notes || null
        }])
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
        .update({
          test_date: testData.testDate,
          test_type: testData.testType,
          // Physical & Chemical Tests
          breakdown: testData.breakdown || null,
          acidity: testData.acidity || null,
          water_content: testData.waterContent || null,
          interfacial_tension: testData.interfacialTension || null,
          color: testData.color || null,
          flash_point: testData.flashPoint || null,
          inhibitor: testData.inhibitor || null,
          copper_corrosive: testData.copperCorrosive || null,
          density: testData.density || null,
          dbds: testData.dbds || null,
          viscosity_40: testData.viscosity40 || null,
          methanol: testData.methanol || null,
          pcb: testData.pcb || null,
          power_factor: testData.powerFactor || null,
          resistivity: testData.resistivity || null,
          specific_gravity: testData.specificGravity || null,
          passivator: testData.passivator || null,
          // DGA
          h2: testData.h2 || null,
          ch4: testData.ch4 || null,
          c2h2: testData.c2h2 || null,
          c2h4: testData.c2h4 || null,
          c2h6: testData.c2h6 || null,
          co: testData.co || null,
          co2: testData.co2 || null,
          o2: testData.o2 || null,
          n2: testData.n2 || null,
          tdcg: testData.tdcg || null,
          // Furanic Compounds
          fol_2: testData.fol2 || null,
          hmf_5: testData.hmf5 || null,
          fal_2: testData.fal2 || null,
          acf_2: testData.acf2 || null,
          mef_5: testData.mef5 || null,
          // Metals-in-Oil
          copper_cu: testData.copperCu || null,
          iron_fe: testData.ironFe || null,
          aluminum_al: testData.aluminumAl || null,
          // Estimate DP
          estimated_dp_furan: testData.estimatedDpFuran || null,
          estimated_dp_methanol: testData.estimatedDpMethanol || null,
          notes: testData.notes || null
        })
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
  }
};

/**
 * Helper function to transform oil test data from snake_case to camelCase
 */
function transformOilTest(test) {
  return {
    id: test.id,
    testDate: test.test_date,
    testType: test.test_type,
    // Physical & Chemical Tests
    breakdown: test.breakdown,
    acidity: test.acidity,
    waterContent: test.water_content,
    interfacialTension: test.interfacial_tension,
    color: test.color,
    flashPoint: test.flash_point,
    inhibitor: test.inhibitor,
    copperCorrosive: test.copper_corrosive,
    density: test.density,
    dbds: test.dbds,
    viscosity40: test.viscosity_40,
    methanol: test.methanol,
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
