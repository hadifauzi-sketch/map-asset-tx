import { supabase } from './supabaseClient';

function transformIntervention(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    transformerId: record.transformer_id,
    eventDate: record.event_date,
    eventType: record.event_type,
    compartment: record.compartment || '',
    oilVolumeLitres: record.oil_volume_litres,
    performedBy: record.performed_by || '',
    notes: record.notes || '',
    createdAt: record.created_at,
  };
}

function buildPayload(data) {
  return {
    event_date: data.eventDate,
    event_type: data.eventType,
    compartment: String(data.compartment ?? '').trim() || null,
    oil_volume_litres:
      data.oilVolumeLitres === '' || data.oilVolumeLitres === null || data.oilVolumeLitres === undefined
        ? null
        : Number(data.oilVolumeLitres),
    performed_by: String(data.performedBy ?? '').trim() || null,
    notes: String(data.notes ?? '').trim() || null,
  };
}

export const interventionService = {
  async getByTransformerId(transformerId) {
    try {
      const { data, error } = await supabase
        .from('asset_interventions')
        .select('*')
        .eq('transformer_id', transformerId)
        .order('event_date', { ascending: false });

      if (error) throw error;

      return (data || []).map(transformIntervention);
    } catch (error) {
      console.error('Error fetching interventions:', error);
      throw error;
    }
  },

  async create(transformerId, data) {
    try {
      const { data: created, error } = await supabase
        .from('asset_interventions')
        .insert([{ transformer_id: transformerId, ...buildPayload(data) }])
        .select()
        .single();

      if (error) throw error;

      return transformIntervention(created);
    } catch (error) {
      console.error('Error creating intervention:', error);
      throw error;
    }
  },

  async update(id, data) {
    try {
      const { data: updated, error } = await supabase
        .from('asset_interventions')
        .update(buildPayload(data))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return transformIntervention(updated);
    } catch (error) {
      console.error('Error updating intervention:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase.from('asset_interventions').delete().eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting intervention:', error);
      throw error;
    }
  },
};
