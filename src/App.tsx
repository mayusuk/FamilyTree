import { useState, useCallback, useEffect } from 'react';
import type { Person, PersonId } from './types';
import {
  addChildRelations,
  getAllRelationships,
  createPerson,
  deletePerson,
  getAllPeople,
  getParentIds,
  getPartnerId,
  getPerson,
  setParentRelations,
  setPartnerRelation,
  updatePerson,
} from './store';
import { PersonForm, type PersonFormData } from './PersonForm';
import { FamilyTreeView } from './FamilyTreeView';
import { RelationshipManager } from './RelationshipManager';
import { composeDisplayName, getInitial } from './personName';
import './App.css';

type View = 'list' | 'tree';

function usePeople() {
  const [people, setPeople] = useState<Person[]>(getAllPeople());
  const [relationships, setRelationships] = useState(getAllRelationships());
  const refresh = useCallback(() => {
    setPeople(getAllPeople());
    setRelationships(getAllRelationships());
  }, []);
  return { people, relationships, refresh };
}

export default function App() {
  const { people, relationships, refresh } = usePeople();
  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<PersonId | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [selectedTreeId, setSelectedTreeId] = useState<PersonId | null>(null);
  const [focusedTreePersonId, setFocusedTreePersonId] = useState<PersonId | null>(null);
  const [activeFormState, setActiveFormState] = useState<{ data: PersonFormData | null; dirty: boolean }>({
    data: null,
    dirty: false,
  });
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);

  // Close mobile panels when switching views
  useEffect(() => {
    setMobileSidebar(false);
    setMobileDetail(false);
  }, [view]);

  // Open detail when a tree node is selected on mobile
  useEffect(() => {
    if (selectedTreeId && view === 'tree') {
      setMobileDetail(true);
    }
  }, [selectedTreeId, view]);

  const editingPerson = editingId ? getPerson(editingId) : null;

  const persistPerson = (data: PersonFormData, existingId?: PersonId): PersonId | null => {
    if (existingId) {
      const updated = updatePerson(existingId, {
        firstName: data.firstName,
        middleName: data.middleName,
        surname: data.surname,
        birthDate: data.birthDate,
        city: data.city,
        sex: data.sex,
        deathDate: data.deathDate || undefined,
        photo: data.photo,
        notes: data.notes,
        isCurrentUser: data.isCurrentUser,
      });
      refresh();
      return updated?.id ?? existingId;
    } else {
      const created = createPerson({
        firstName: data.firstName,
        middleName: data.middleName,
        surname: data.surname,
        birthDate: data.birthDate,
        city: data.city,
        sex: data.sex,
        deathDate: data.deathDate || undefined,
        photo: data.photo,
        notes: data.notes,
        isCurrentUser: data.isCurrentUser,
      });
      refresh();
      return created.id;
    }
  };

  const handleSave = (data: PersonFormData, existingId?: PersonId) => {
    persistPerson(data, existingId);
    setEditingId(null);
    setAddingNew(false);
    setActiveFormState({ data: null, dirty: false });
  };

  const switchToPersonInList = (nextId: PersonId) => {
    if (addingNew && activeFormState.dirty && activeFormState.data) {
      const save = confirm('You have unsaved changes in the new person form. Click OK to save, or Cancel to discard and switch.');
      if (save) persistPerson(activeFormState.data);
    } else if (editingId && editingId !== nextId && activeFormState.dirty && activeFormState.data) {
      const save = confirm('You have unsaved changes. Click OK to save this person before switching, or Cancel to discard and switch.');
      if (save) persistPerson(activeFormState.data, editingId);
    }
    setEditingId(nextId);
    setAddingNew(false);
  };

  const beginAddPerson = () => {
    if (addingNew && activeFormState.dirty && activeFormState.data) {
      const save = confirm('You have unsaved changes in the new person form. Click OK to save, or Cancel to discard and start a fresh form.');
      if (save) persistPerson(activeFormState.data);
    } else if (editingId && activeFormState.dirty && activeFormState.data) {
      const save = confirm('You have unsaved changes. Click OK to save current person, or Cancel to discard and open new person form.');
      if (save) persistPerson(activeFormState.data, editingId);
    }
    setEditingId(null);
    setAddingNew(true);
  };

  const handleSaveParents = (personId: PersonId, update: { motherId: PersonId | null; fatherId: PersonId | null }) => {
    setParentRelations(personId, update.motherId, update.fatherId);
    refresh();
  };

  const handleSavePartner = (personId: PersonId, partnerId: PersonId | null) => {
    setPartnerRelation(personId, partnerId);
    refresh();
  };

  const handleAddChildren = (personId: PersonId, childIds: PersonId[], includePartnerAsCoParent: boolean) => {
    addChildRelations(personId, childIds, includePartnerAsCoParent);
    refresh();
  };

  const handleDelete = (id: PersonId) => {
    if (confirm('Remove this person from the tree? They will be unlinked from others.')) {
      deletePerson(id);
      setEditingId(null);
      setSelectedTreeId(null);
      refresh();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Family Tree</h1>
        <nav className="view-tabs">
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            List
          </button>
          <button
            type="button"
            className={view === 'tree' ? 'active' : ''}
            onClick={() => {
              setView('tree');
              if (editingId) setSelectedTreeId(editingId);
            }}
          >
            Tree
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'list' && (
          <div className="list-layout">
            <section className="list-section">
              <div className="list-header">
                <h2>People</h2>
                <button type="button" className="btn btn-primary" onClick={beginAddPerson}>
                  + Add person
                </button>
              </div>
              <ul className="person-list">
                {people.map((p) => (
                  <li key={p.id} className="person-list-item">
                    <button
                      type="button"
                      className={`person-list-card ${editingId === p.id ? 'selected' : ''}`}
                      onClick={() => switchToPersonInList(p.id)}
                    >
                      <div className="person-list-photo">
                        {p.photo ? (
                          <img src={p.photo} alt="" />
                        ) : (
                          <span>{getInitial(p)}</span>
                        )}
                      </div>
                      <div className="person-list-info">
                        <strong>{composeDisplayName(p)}</strong>
                        <span className="muted">{p.birthDate}{p.city ? ` · ${p.city}` : ''}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="form-section">
              {addingNew && (
                <>
                  <h2>New person</h2>
                  <PersonForm
                    key="new-person-form"
                    onSubmit={(data) => handleSave(data)}
                    onCancel={() => { setAddingNew(false); }}
                    onStateChange={setActiveFormState}
                  />
                </>
              )}
              {editingPerson && !addingNew && (
                <>
                  <h2>Edit person</h2>
                  <PersonForm
                    key={`edit-person-${editingPerson.id}`}
                    person={editingPerson}
                    onSubmit={(data) => handleSave(data, editingPerson.id)}
                    onCancel={() => setEditingId(null)}
                    onStateChange={setActiveFormState}
                  />
                  <RelationshipManager
                    person={editingPerson}
                    allPeople={people}
                    currentMotherId={getParentIds(editingPerson.id).motherId}
                    currentFatherId={getParentIds(editingPerson.id).fatherId}
                    currentPartnerId={getPartnerId(editingPerson.id)}
                    onSaveParents={(update) => handleSaveParents(editingPerson.id, update)}
                    onSavePartner={(partnerId) => handleSavePartner(editingPerson.id, partnerId)}
                    onAddChildren={(childIds, includePartnerAsCoParent) =>
                      handleAddChildren(editingPerson.id, childIds, includePartnerAsCoParent)
                    }
                  />
                  <button type="button" className="btn btn-danger btn-block" onClick={() => handleDelete(editingPerson.id)}>
                    Remove from tree
                  </button>
                </>
              )}
              {!editingPerson && !addingNew && (
                <div className="form-placeholder">
                  <p className="muted">Select a person to edit or add a new one.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {view === 'tree' && (
          <div className="tree-layout">
            {/* Mobile floating action buttons */}
            <div className="tree-mobile-fab">
              <button
                type="button"
                className={`btn btn-fab ${mobileSidebar ? 'active' : ''}`}
                onClick={() => { setMobileSidebar((v) => !v); setMobileDetail(false); }}
                aria-label="People list"
              >
                <span aria-hidden="true">&#9776;</span>
              </button>
              <button
                type="button"
                className={`btn btn-fab ${mobileDetail ? 'active' : ''}`}
                onClick={() => { setMobileDetail((v) => !v); setMobileSidebar(false); }}
                aria-label="Person details"
              >
                <span aria-hidden="true">&#9432;</span>
              </button>
            </div>

            <aside className={`tree-people-sidebar ${mobileSidebar ? 'mobile-open' : ''}`}>
              <div className="list-header">
                <h2>People</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {focusedTreePersonId && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setFocusedTreePersonId(null)}
                    >
                      Zoom out
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost mobile-close-btn"
                    onClick={() => setMobileSidebar(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <ul className="person-list tree-person-list">
                {people.map((p) => (
                  <li key={p.id} className="person-list-item">
                    <button
                      type="button"
                      className={`person-list-card ${focusedTreePersonId === p.id ? 'selected' : ''}`}
                      onClick={() => {
                        setFocusedTreePersonId(p.id);
                        setSelectedTreeId(p.id);
                        setMobileSidebar(false);
                      }}
                    >
                      <div className="person-list-photo">
                        {p.photo ? <img src={p.photo} alt="" /> : <span>{getInitial(p)}</span>}
                      </div>
                      <div className="person-list-info">
                        <strong>{composeDisplayName(p)}</strong>
                        <span className="muted">{p.city || 'No city'}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            {/* Mobile overlay backdrop */}
            {(mobileSidebar || mobileDetail) && (
              <div className="mobile-overlay-backdrop" onClick={() => { setMobileSidebar(false); setMobileDetail(false); }} />
            )}
            <div className="tree-panel">
              <FamilyTreeView
                people={people}
                relationships={relationships}
                selectedId={selectedTreeId}
                focusPersonId={focusedTreePersonId}
                onSelect={setSelectedTreeId}
              />
            </div>
            <aside className={`tree-detail ${mobileDetail ? 'mobile-open' : ''}`}>
              <button
                type="button"
                className="btn btn-ghost mobile-close-btn"
                onClick={() => setMobileDetail(false)}
                aria-label="Close"
                style={{ float: 'right' }}
              >
                ✕
              </button>
              {selectedTreeId ? (
                (() => {
                  const p = getPerson(selectedTreeId);
                  if (!p) return null;
                  return (
                    <>
                      <h2>{composeDisplayName(p)}</h2>
                      <div className="detail-photo">
                        {p.photo ? <img src={p.photo} alt="" /> : <span>{getInitial(p)}</span>}
                      </div>
                      <dl className="detail-meta">
                        {p.birthDate && <><dt>Birth</dt><dd>{p.birthDate}</dd></>}
                        {p.deathDate && <><dt>Death</dt><dd>{p.deathDate}</dd></>}
                        {p.city && <><dt>City</dt><dd>{p.city}</dd></>}
                        {p.notes && <><dt>Notes</dt><dd>{p.notes}</dd></>}
                      </dl>
                      <button type="button" className="btn btn-primary" onClick={() => { setView('list'); setEditingId(p.id); setSelectedTreeId(null); }}>
                        Edit
                      </button>
                    </>
                  );
                })()
              ) : (
                <p className="muted">Tap a person on the tree to see details.</p>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
