import { useMemo, useState } from 'react';
import type { Person, PersonId } from './types';
import { composeDisplayName } from './personName';

interface RelationshipManagerProps {
  person: Person;
  allPeople: Person[];
  currentMotherId?: PersonId | null;
  currentFatherId?: PersonId | null;
  currentPartnerId?: PersonId | null;
  onSaveParents: (update: { motherId: PersonId | null; fatherId: PersonId | null }) => void;
  onSavePartner: (partnerId: PersonId | null) => void;
  onAddChildren: (childIds: PersonId[], includePartnerAsCoParent: boolean) => void;
}

export function RelationshipManager({
  person,
  allPeople,
  currentMotherId,
  currentFatherId,
  currentPartnerId,
  onSaveParents,
  onSavePartner,
  onAddChildren,
}: RelationshipManagerProps) {
  const [motherId, setMotherId] = useState<PersonId | ''>(currentMotherId ?? '');
  const [fatherId, setFatherId] = useState<PersonId | ''>(currentFatherId ?? '');
  const [partnerId, setPartnerId] = useState<PersonId | ''>(currentPartnerId ?? '');
  const [selectedChildIds, setSelectedChildIds] = useState<PersonId[]>([]);
  const [includePartnerAsCoParent, setIncludePartnerAsCoParent] = useState(true);

  const options = useMemo(
    () => allPeople.filter((p) => p.id !== person.id),
    [allPeople, person.id]
  );
  const motherOptions = options.filter((p) => p.sex === 'female' || p.sex === 'unknown');
  const fatherOptions = options.filter((p) => p.sex === 'male' || p.sex === 'unknown');
  const partnerOptions = options.filter((p) => p.id !== motherId && p.id !== fatherId);
  const childOptions = options;

  const toggleChild = (id: PersonId) => {
    setSelectedChildIds((prev) => (
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    ));
  };

  const handleSaveParents = () => {
    const nextMother = motherId || null;
    const nextFather = fatherId || null;
    if (nextMother && nextFather && nextMother === nextFather) return;
    onSaveParents({ motherId: nextMother, fatherId: nextFather });
  };

  return (
    <section className="relationship-panel">
      <h3>Manage Relationships</h3>
      <p className="muted">Add Parent, Partner, and Child relationships.</p>

      <div className="relationship-group">
        <h4>Add Parent</h4>
        <div className="form-row">
          <label>Mother</label>
          <select value={motherId} onChange={(e) => setMotherId(e.target.value)}>
            <option value="">— Select Mother —</option>
            {motherOptions.map((p) => (
              <option key={p.id} value={p.id}>{composeDisplayName(p)}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Father</label>
          <select value={fatherId} onChange={(e) => setFatherId(e.target.value)}>
            <option value="">— Select Father —</option>
            {fatherOptions.map((p) => (
              <option key={p.id} value={p.id}>{composeDisplayName(p)}</option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={handleSaveParents}>
            Save Parent Relation
          </button>
        </div>
      </div>

      <div className="relationship-group">
        <h4>Add Partner</h4>
        <div className="form-row">
          <label>Partner</label>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">— No partner —</option>
            {partnerOptions.map((p) => (
              <option key={p.id} value={p.id}>{composeDisplayName(p)}</option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => onSavePartner(partnerId || null)}>
            Save Partner Relation
          </button>
        </div>
      </div>

      <div className="relationship-group">
        <h4>Add Child</h4>
        <div className="form-row">
          <label>Children (select one or more)</label>
          <div className="checkbox-group">
            {childOptions.map((p) => (
              <label key={p.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedChildIds.includes(p.id)}
                  onChange={() => toggleChild(p.id)}
                />
                {composeDisplayName(p)}
              </label>
            ))}
          </div>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={includePartnerAsCoParent}
            onChange={(e) => setIncludePartnerAsCoParent(e.target.checked)}
          />
          Also add current partner as co-parent (if partner exists)
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => selectedChildIds.length > 0 && onAddChildren(selectedChildIds, includePartnerAsCoParent)}
            disabled={selectedChildIds.length === 0}
          >
            Save Child Relations
          </button>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => {
          setMotherId(currentMotherId ?? '');
          setFatherId(currentFatherId ?? '');
          setPartnerId(currentPartnerId ?? '');
          setSelectedChildIds([]);
        }}>
          Reset
        </button>
      </div>
    </section>
  );
}
