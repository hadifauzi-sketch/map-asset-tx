import { supabase } from './supabaseClient';
import { normalizeFloorPlan } from './floorPlanStorage';

const LEGACY_STORAGE_KEY = 'asset-tx-map-floor-plan-v1';

function toRow(plan) {
  return {
    id: plan.id,
    name: plan.name,
    company_name: plan.companyName,
    state: plan.state,
    points: plan.points,
    transformer_ids: plan.transformerIds,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    companyName: row.company_name || '',
    state: row.state || '',
    points: Array.isArray(row.points) ? row.points : [],
    transformerIds: Array.isArray(row.transformer_ids) ? row.transformer_ids : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const floorPlanService = {
  async getAll() {
    const { data, error } = await supabase
      .from('floor_plans')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data.map(fromRow).filter((plan) => plan.points.length >= 3);
  },

  async upsert(plan) {
    const row = toRow(normalizeFloorPlan(plan));
    const { data, error } = await supabase
      .from('floor_plans')
      .upsert([row], { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  },

  async updateTransformerIds(id, transformerIds) {
    const { error } = await supabase
      .from('floor_plans')
      .update({ transformer_ids: transformerIds, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase.from('floor_plans').delete().eq('id', id);
    if (error) throw error;
  },

  async migrateFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
      }
      await Promise.all(parsed.map((plan) => this.upsert(plan)));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      console.error('Floor plan localStorage migration failed:', err);
    }
  },
};
