import { supabase } from '../lib/supabaseClient';
import { uploadStorageObjectWithRetry } from './storageUploadUtils';

/**
 * Document Database Service
 * Handles file uploads to Supabase Storage and metadata in database
 */

const BUCKET_NAME = 'transformer-documents';

export const documentService = {
  /**
   * Get all documents for a transformer
   */
  async getByTransformerId(transformerId) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('transformer_id', transformerId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      return data.map(doc => transformDocument(doc));
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  },

  /**
   * Upload a file and create document record
   */
  async upload(transformerId, file, options = {}) {
    try {
      const imageCategory =
        typeof options?.imageCategory === 'string' && options.imageCategory.trim()
          ? options.imageCategory.trim()
          : null;

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${transformerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload file to Supabase Storage
      const uploadData = await uploadStorageObjectWithRetry(
        supabase.storage.from(BUCKET_NAME),
        fileName,
        file,
        {
          cacheControl: '3600',
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        }
      );
      const uploadedPath = uploadData?.path || fileName;

      // Create document metadata in database
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert([{
          transformer_id: transformerId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: uploadedPath,
          image_category: imageCategory,
        }])
        .select()
        .single();

      if (docError) throw docError;

      return transformDocument(docData);
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  /**
   * Get public URL for a document
   */
  getPublicUrl(storagePath) {
    try {
      const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error getting public URL:', error);
      throw error;
    }
  },

  /**
   * Download a document
   */
  async download(storagePath, fileName) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(storagePath);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  /**
   * Delete a document (from storage and database)
   */
  async delete(documentId, storagePath) {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  /**
   * Update image category metadata for an existing document.
   */
  async updateImageCategory(documentId, imageCategory) {
    const nextCategory =
      typeof imageCategory === 'string' && imageCategory.trim() ? imageCategory.trim() : null;

    const { data, error } = await supabase
      .from('documents')
      .update({ image_category: nextCategory })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating image category:', error);
      throw error;
    }

    return transformDocument(data);
  },

  /**
   * Upload multiple files
   */
  async uploadMultiple(transformerId, files, options = {}) {
    try {
      const uploadPromises = Array.from(files).map((file) =>
        this.upload(transformerId, file, options)
      );

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple documents:', error);
      throw error;
    }
  }
};

/**
 * Helper function to transform document data
 */
function transformDocument(doc) {
  return {
    id: doc.id,
    fileName: doc.file_name,
    fileType: doc.file_type,
    fileSize: doc.file_size,
    storagePath: doc.storage_path,
    uploadedAt: doc.uploaded_at,
    imageCategory: doc.image_category || null,
    url: supabase.storage.from(BUCKET_NAME).getPublicUrl(doc.storage_path).data.publicUrl
  };
}
