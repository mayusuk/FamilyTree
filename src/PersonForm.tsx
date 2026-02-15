import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Person, Sex } from './types';

interface PersonFormProps {
  person?: Person | null;
  onSubmit: (data: PersonFormData) => void;
  onCancel?: () => void;
  onStateChange?: (state: { data: PersonFormData; dirty: boolean }) => void;
}

export interface PersonFormData {
  firstName: string;
  middleName: string;
  surname: string;
  birthDate: string;
  city: string;
  sex: Sex;
  deathDate: string;
  photo?: string;
  notes: string;
  isCurrentUser: boolean;
}

const emptyForm: PersonFormData = {
  firstName: '',
  middleName: '',
  surname: '',
  birthDate: '',
  city: '',
  sex: 'unknown',
  deathDate: '',
  photo: undefined,
  notes: '',
  isCurrentUser: false,
};

function personToForm(p: Person): PersonFormData {
  return {
    firstName: p.firstName || '',
    middleName: p.middleName || '',
    surname: p.surname || '',
    birthDate: p.birthDate || '',
    city: p.city || '',
    sex: p.sex ?? 'unknown',
    deathDate: p.deathDate || '',
    photo: p.photo,
    notes: p.notes || '',
    isCurrentUser: p.isCurrentUser ?? false,
  };
}

export function PersonForm({ person, onSubmit, onCancel, onStateChange }: PersonFormProps) {
  const initial = person ? personToForm(person) : emptyForm;
  const [form, setForm] = useState<PersonFormData>(initial);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseline = useMemo(() => JSON.stringify(initial), [initial]);

  const emitState = (next: PersonFormData) => {
    const dirty = JSON.stringify(next) !== baseline;
    onStateChange?.({ data: next, dirty });
  };

  useEffect(() => {
    emitState(form);
    // baseline changes when person changes (or new form opens)
  }, [baseline, form]);

  const handleChange = (field: keyof PersonFormData, value: string | undefined | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleChange('photo', reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="person-form" onSubmit={handleSubmit}>
      <div className="form-row form-photo">
        <div className="photo-upload">
          {form.photo ? (
            <div className="photo-preview">
              <img src={form.photo} alt="" />
              <button type="button" className="photo-remove" onClick={() => handleChange('photo', undefined)}>
                Remove photo
              </button>
            </div>
          ) : (
            <button type="button" className="photo-placeholder" onClick={() => fileInputRef.current?.click()}>
              + Add photo
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>
      </div>

      <div className="form-row double">
        <div>
          <label>First name *</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="First name"
            required
          />
        </div>
        <div>
          <label>Middle name</label>
          <input
            type="text"
            value={form.middleName}
            onChange={(e) => handleChange('middleName', e.target.value)}
            placeholder="Middle name"
          />
        </div>
      </div>

      <div className="form-row">
        <label>Surname *</label>
        <input
          type="text"
          value={form.surname}
          onChange={(e) => handleChange('surname', e.target.value)}
          placeholder="Surname"
          required
        />
      </div>

      <div className="form-row double">
        <div>
          <label>Birth date</label>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
          />
        </div>
        <div>
          <label>Death date</label>
          <input
            type="date"
            value={form.deathDate}
            onChange={(e) => handleChange('deathDate', e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <label>City</label>
        <input
          type="text"
          value={form.city}
          onChange={(e) => handleChange('city', e.target.value)}
          placeholder="City or place"
        />
      </div>

      <div className="form-row">
        <label>Sex</label>
        <select value={form.sex} onChange={(e) => handleChange('sex', e.target.value as Sex)}>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
          <option value="unknown">Prefer not to say</option>
        </select>
      </div>

      <div className="form-row">
        <label>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Optional notes"
          rows={3}
        />
      </div>

      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.isCurrentUser}
            onChange={(e) => handleChange('isCurrentUser', e.target.checked)}
          />
          This is me (mark as &quot;You&quot; in the tree)
        </label>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {person ? 'Save profile' : 'Add person'}
        </button>
      </div>
    </form>
  );
}
