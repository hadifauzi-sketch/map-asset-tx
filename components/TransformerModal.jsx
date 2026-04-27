import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { createTransformerDraft } from '../lib/transformerDraft';
import TransformerFormFields from './transformer/TransformerFormFields';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

function TransformerModal({ open, transformer, onSave, onClose }) {
  const [formData, setFormData] = useState(() => createTransformerDraft());

  useEffect(() => {
    setFormData(createTransformerDraft(transformer));
  }, [transformer]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.siteName.trim()) {
      window.alert('Please enter a site name.');
      return;
    }
    if (!formData.txName.trim()) {
      window.alert('Please enter a transformer name.');
      return;
    }
    if (!formData.voltage.trim()) {
      window.alert('Please enter a voltage.');
      return;
    }

    const normalizedFormData = createTransformerDraft(formData);

    onSave({
      ...normalizedFormData,
      id: transformer?.id || Date.now().toString(),
    });
  };

  const latitude = Number(formData.position?.[0]);
  const longitude = Number(formData.position?.[1]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-3xl p-0">
        <DialogHeader>
          <DialogTitle>{transformer?.id ? 'Edit transformer' : 'Add transformer'}</DialogTitle>
          <DialogDescription>
            Capture the asset identity, electrical rating, and exact map placement for this transformer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mobile-dialog-form">
          <div className="mobile-dialog-scroll space-y-5 px-4 py-4 sm:px-5 sm:py-5">
            <TransformerFormFields formData={formData} onChange={handleChange} />

            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Map placement</p>
                  <p className="text-sm text-[var(--muted)]">
                    Latitude {Number.isFinite(latitude) ? latitude.toFixed(6) : '--'} and longitude {Number.isFinite(longitude) ? longitude.toFixed(6) : '--'}. Drag the marker on the map later if you need to refine the position.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="mt-auto px-4 sm:px-5">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{transformer?.id ? 'Update transformer' : 'Save transformer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TransformerModal;
