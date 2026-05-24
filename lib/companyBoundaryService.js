import { supabase } from './supabaseClient';
import { normalizeCompanyBoundary } from './companyBoundaryStorage';

function toRow(boundary) {
  return {
    id: boundary.id,
    company_name: boundary.companyName,
    state: boundary.state,
    notes: boundary.notes,
    points: boundary.points,
    created_at: boundary.createdAt,
    updated_at: boundary.updatedAt,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    companyName: row.company_name || '',
    state: row.state || '',
    notes: row.notes || '',
    points: Array.isArray(row.points) ? row.points : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const companyBoundaryService = {
  async getAll() {
    const { data, error } = await supabase
      .from('company_boundaries')
      .select('*')
      .order('company_name', { ascending: true });
    if (error) throw error;
    return data.map(fromRow).filter((boundary) => boundary.points.length >= 3);
  },

  async upsert(boundary) {
    const row = toRow(normalizeCompanyBoundary(boundary));
    const { data, error } = await supabase
      .from('company_boundaries')
      .upsert([row], { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  },

  async delete(id) {
    const { error } = await supabase.from('company_boundaries').delete().eq('id', id);
    if (error) throw error;
  },
};
