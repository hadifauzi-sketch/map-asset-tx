import { supabase } from '../lib/supabaseClient';

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
      return data.map(transformer => ({
        id: transformer.id,
        siteName: transformer.site_name,
        state: transformer.state || '',
        txName: transformer.tx_name,
        mnemonic: transformer.mnemonic,
        serialNumber: transformer.serial_number,
        voltage: transformer.voltage,
        loadMVA: transformer.load_mva,
        maker: transformer.maker,
        yearBuilt: transformer.year_built,
        position: [transformer.latitude, transformer.longitude],
        oilTests: transformer.oil_tests?.map(test => transformOilTest(test)) || [],
        documents: transformer.documents?.map(doc => transformDocument(doc)) || [],
        createdAt: transformer.created_at,
        updatedAt: transformer.updated_at
      }));
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

      return {
        id: data.id,
        siteName: data.site_name,
        state: data.state || '',
        txName: data.tx_name,
        mnemonic: data.mnemonic,
        serialNumber: data.serial_number,
        voltage: data.voltage,
        loadMVA: data.load_mva,
        maker: data.maker,
        yearBuilt: data.year_built,
        position: [data.latitude, data.longitude],
        oilTests: data.oil_tests?.map(test => transformOilTest(test)) || [],
        documents: data.documents?.map(doc => transformDocument(doc)) || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
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

      return {
        id: data.id,
        siteName: data.site_name,
        state: data.state || '',
        txName: data.tx_name,
        mnemonic: data.mnemonic,
        serialNumber: data.serial_number,
        voltage: data.voltage,
        loadMVA: data.load_mva,
        maker: data.maker,
        yearBuilt: data.year_built,
        position: [data.latitude, data.longitude],
        oilTests: [],
        documents: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
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

      return {
        id: data.id,
        siteName: data.site_name,
        state: data.state || '',
        txName: data.tx_name,
        mnemonic: data.mnemonic,
        serialNumber: data.serial_number,
        voltage: data.voltage,
        loadMVA: data.load_mva,
        maker: data.maker,
        yearBuilt: data.year_built,
        position: [data.latitude, data.longitude],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
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

  return payload;
}
