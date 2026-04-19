import { supabase } from '../lib/supabaseClient';
import { normaliseTestTypeForStorage } from './testTypeUtils';

/**
 * Transformer Database Service
 * Handles all CRUD operations for transformers
 */

export const transformerService = {
  /**
   * Get all transformers
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('transformers')
        .select(`
          *,
          oil_tests (*),
          documents (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform snake_case to camelCase for React
      return data.map(transformer => transformTransformer(transformer, true));
    } catch (error) {
      console.error('Error fetching transformers:', error);
      throw error;
    }
  },

  /**
   * Get a single transformer by ID
   */
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('transformers')
        .select(`
          *,
          oil_tests (*),
          documents (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return transformTransformer(data, true);
    } catch (error) {
      console.error('Error fetching transformer:', error);
      throw error;
    }
  },

  /**
   * Create a new transformer
   */
  async create(transformerData) {
    try {
      const payload = buildTransformerPayload(transformerData);
      const { data, error } = await supabase
        .from('transformers')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      return transformTransformer(data, false);
    } catch (error) {
      console.error('Error creating transformer:', error);
      throw error;
    }
  },

  /**
   * Update a transformer
   */
  async update(id, transformerData) {
    try {
      const payload = buildTransformerPayload(transformerData);
      const { data, error } = await supabase
        .from('transformers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return transformTransformer(data, false);
    } catch (error) {
      console.error('Error updating transformer:', error);
      throw error;
    }
  },

  /**
   * Update transformer position (after drag)
   */
  async updatePosition(id, position) {
    try {
      const { error } = await supabase
        .from('transformers')
        .update({
          latitude: position[0],
          longitude: position[1]
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating position:', error);
      throw error;
    }
  },

  /**
   * Update DGA workspace preferences for a transformer
   */
  async updateDgaPreferences(id, preferences = {}) {
    try {
      const payload = {};

      if (preferences.oilType !== undefined) {
        payload.dga_oil_type = preferences.oilType || null;
      }
      if (preferences.gasLimitStandard !== undefined) {
        payload.dga_gas_limit_standard = preferences.gasLimitStandard || null;
      }
      if (preferences.methodView !== undefined) {
        payload.dga_method_view = preferences.methodView || null;
      }

      if (!Object.keys(payload).length) {
        return null;
      }

      const { data, error } = await supabase
        .from('transformers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return transformTransformer(data, false);
    } catch (error) {
      console.error('Error updating DGA preferences:', error);
      throw error;
    }
  },

  /**
   * Delete a transformer
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('transformers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting transformer:', error);
      throw error;
    }
  }
};

/**
 * Helper function to transform oil test data
 */
function transformOilTest(test) {
  return {
    id: test.id,
    testDate: test.test_date,
    testType: normaliseTestTypeForStorage(test.test_type),
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

/**
 * Helper function to transform document data
 */
function transformDocument(doc) {
  return {
    id: doc.id,
    name: doc.file_name,
    type: doc.file_type,
    size: doc.file_size,
    storagePath: doc.storage_path,
    uploadDate: doc.uploaded_at
  };
}

function buildTransformerPayload(transformerData) {
  const payload = {
    site_name: transformerData.siteName,
    tx_name: transformerData.txName,
    mnemonic: transformerData.mnemonic,
    serial_number: transformerData.serialNumber,
    voltage: transformerData.voltage,
    load_mva: transformerData.loadMVA,
    maker: transformerData.maker,
    year_built: transformerData.yearBuilt,
    latitude: transformerData.position[0],
    longitude: transformerData.position[1],
  };

  if (String(transformerData.state || '').trim()) {
    payload.state = transformerData.state.trim();
  }

  if (transformerData.oilType !== undefined) {
    payload.dga_oil_type = transformerData.oilType || null;
  }

  if (transformerData.gasLimitStandard !== undefined) {
    payload.dga_gas_limit_standard = transformerData.gasLimitStandard || null;
  }

  if (transformerData.methodView !== undefined) {
    payload.dga_method_view = transformerData.methodView || null;
  }

  return payload;
}

function transformTransformer(record, includeRelations = true) {
  return {
    id: record.id,
    siteName: record.site_name,
    state: record.state || '',
    txName: record.tx_name,
    mnemonic: record.mnemonic,
    serialNumber: record.serial_number,
    voltage: record.voltage,
    loadMVA: record.load_mva,
    maker: record.maker,
    yearBuilt: record.year_built,
    position: [record.latitude, record.longitude],
    oilType: record.dga_oil_type || null,
    gasLimitStandard: record.dga_gas_limit_standard || null,
    methodView: record.dga_method_view || null,
    oilTests: includeRelations ? record.oil_tests?.map(test => transformOilTest(test)) || [] : undefined,
    documents: includeRelations ? record.documents?.map(doc => transformDocument(doc)) || [] : undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}
