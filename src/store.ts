import { v4 as uuidv4 } from 'uuid';
import type { FamilyData, Person, PersonId, RelationshipRoleName, RelationshipVertex, Sex } from './types';
import { INITIAL_FAMILY_DATA } from './seedData';

const STORAGE_KEY = 'family-tree-data';

type LegacyPerson = Omit<Person, 'firstName' | 'middleName' | 'surname'> & {
  name?: string;
  firstName?: string;
  middleName?: string;
  fatherName?: string;
  surname?: string;
  motherId?: PersonId | null;
  fatherId?: PersonId | null;
  spouseIds?: PersonId[];
  sex?: Sex;
};

function normalizeSex(input: unknown): Sex {
  if (input === 'male' || input === 'female' || input === 'other') return input;
  return 'unknown';
}

function splitLegacyName(name: string | undefined): { firstName: string; middleName: string; surname: string } {
  const safe = (name ?? '').trim();
  if (!safe) return { firstName: '', middleName: '', surname: '' };
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], middleName: '', surname: '' };
  if (parts.length === 2) return { firstName: parts[0], middleName: '', surname: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    surname: parts[parts.length - 1],
  };
}

function normalizePerson(input: LegacyPerson): Person {
  const fromLegacy = splitLegacyName(input.name);
  return {
    id: input.id,
    firstName: (input.firstName ?? fromLegacy.firstName).trim(),
    middleName: (input.middleName ?? input.fatherName ?? fromLegacy.middleName).trim(),
    surname: (input.surname ?? fromLegacy.surname).trim(),
    birthDate: input.birthDate ?? '',
    city: input.city ?? '',
    sex: normalizeSex(input.sex),
    deathDate: input.deathDate,
    photo: input.photo,
    notes: input.notes,
    isCurrentUser: input.isCurrentUser,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function cloneData(data: FamilyData): FamilyData {
  return {
    people: data.people.map((p) => ({ ...p })),
    relationships: data.relationships.map((r) => ({ ...r })),
  };
}

function getSeedData(): FamilyData {
  return cloneData(INITIAL_FAMILY_DATA);
}

function createEdge(
  personAId: PersonId,
  personBId: PersonId,
  type: 'parent' | 'partner',
  roleA: RelationshipRoleName,
  roleB: RelationshipRoleName
): RelationshipVertex {
  return {
    id: uuidv4(),
    person_a_id: personAId,
    person_b_id: personBId,
    type,
    direction: 'directed',
    role_a: roleA,
    role_b: roleB,
    createdAt: new Date().toISOString(),
  };
}

function migrateLegacy(legacyPeople: LegacyPerson[]): FamilyData {
  const relationships: RelationshipVertex[] = [];
  const seenPartnerKey = new Set<string>();
  const people: Person[] = legacyPeople.map((p) => normalizePerson(p));

  legacyPeople.forEach((p) => {
    if (p.motherId) relationships.push(createEdge(p.motherId, p.id, 'parent', 'mother', 'child'));
    if (p.fatherId) relationships.push(createEdge(p.fatherId, p.id, 'parent', 'dad', 'child'));
    (p.spouseIds ?? []).forEach((spouseId) => {
      const key = [p.id, spouseId].sort().join(':');
      if (seenPartnerKey.has(key)) return;
      seenPartnerKey.add(key);
      relationships.push(createEdge(p.id, spouseId, 'partner', 'partner', 'partner'));
    });
  });

  return { people, relationships };
}

function loadData(): FamilyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = getSeedData();
      saveData(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as
      | FamilyData
      | LegacyPerson[]
      | { people?: LegacyPerson[]; relationshipTree?: Record<PersonId, any[]> };

    // Legacy format: array of people with embedded relation fields.
    if (Array.isArray(parsed)) return migrateLegacy(parsed);

    // Legacy graph format: relationshipTree adjacency.
    if ('relationshipTree' in parsed && parsed.relationshipTree) {
      const people = (parsed.people ?? []).map((p) => normalizePerson(p));
      const relationships: RelationshipVertex[] = [];
      const seenPartnerKey = new Set<string>();
      Object.entries(parsed.relationshipTree).forEach(([fromId, list]) => {
        (list ?? []).forEach((item: any) => {
          if (item.name === 'mother') relationships.push(createEdge(item.toId, fromId, 'parent', 'mother', 'child'));
          if (item.name === 'father') relationships.push(createEdge(item.toId, fromId, 'parent', 'dad', 'child'));
          if (item.name === 'partner') {
            const key = [fromId, item.toId].sort().join(':');
            if (seenPartnerKey.has(key)) return;
            seenPartnerKey.add(key);
            relationships.push(createEdge(fromId, item.toId, 'partner', 'partner', 'partner'));
          }
        });
      });
      return { people, relationships };
    }

    const modern = parsed as { people?: LegacyPerson[]; relationships?: RelationshipVertex[] };
    const people = (modern.people ?? []).map((p) => normalizePerson(p));
    const relationships = (modern.relationships ?? []) as RelationshipVertex[];
    return { people, relationships };
  } catch {
    const seeded = getSeedData();
    try {
      saveData(seeded);
    } catch {
      // Ignore storage write errors and return in-memory seed fallback.
    }
    return seeded;
  }
}

function saveData(data: FamilyData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getAllPeople(): Person[] {
  return loadData().people;
}

export function getAllRelationships(): RelationshipVertex[] {
  return loadData().relationships;
}

export function getPerson(id: string): Person | undefined {
  return loadData().people.find((p) => p.id === id);
}

export function createPerson(partial: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>): Person {
  const data = loadData();
  const now = new Date().toISOString();
  const person: Person = {
    ...partial,
    id: uuidv4(),
    firstName: partial.firstName.trim(),
    middleName: partial.middleName.trim(),
    surname: partial.surname.trim(),
    sex: normalizeSex(partial.sex),
    createdAt: now,
    updatedAt: now,
  };
  data.people.push(person);
  saveData(data);
  return person;
}

export function updatePerson(id: string, updates: Partial<Omit<Person, 'id' | 'createdAt'>>): Person | null {
  const data = loadData();
  const index = data.people.findIndex((p) => p.id === id);
  if (index === -1) return null;
  if (updates.isCurrentUser === true) {
    data.people.forEach((p) => { if (p.id !== id) p.isCurrentUser = false; });
  }
  const updated = {
    ...data.people[index],
    ...updates,
    firstName: (updates.firstName ?? data.people[index].firstName).trim(),
    middleName: (updates.middleName ?? data.people[index].middleName).trim(),
    surname: (updates.surname ?? data.people[index].surname).trim(),
    sex: normalizeSex(updates.sex ?? data.people[index].sex),
    updatedAt: new Date().toISOString(),
  };
  data.people[index] = updated;
  saveData(data);
  return updated;
}

export function getParentIds(personId: PersonId): { motherId: PersonId | null; fatherId: PersonId | null } {
  const relationships = loadData().relationships.filter(
    (r) => r.type === 'parent' && r.person_b_id === personId
  );
  return {
    motherId: relationships.find((r) => r.role_a === 'mother')?.person_a_id ?? null,
    fatherId: relationships.find((r) => r.role_a === 'dad')?.person_a_id ?? null,
  };
}

export function getPartnerId(personId: PersonId): PersonId | null {
  const edge = loadData().relationships.find(
    (r) => r.type === 'partner' && (r.person_a_id === personId || r.person_b_id === personId)
  );
  if (!edge) return null;
  return edge.person_a_id === personId ? edge.person_b_id : edge.person_a_id;
}

export function setParentRelations(personId: PersonId, motherId: PersonId | null, fatherId: PersonId | null) {
  const data = loadData();
  data.relationships = data.relationships.filter(
    (r) => !(r.type === 'parent' && r.person_b_id === personId)
  );
  if (motherId) data.relationships.push(createEdge(motherId, personId, 'parent', 'mother', 'child'));
  if (fatherId) data.relationships.push(createEdge(fatherId, personId, 'parent', 'dad', 'child'));
  saveData(data);
}

export function setPartnerRelation(personId: PersonId, partnerId: PersonId | null) {
  const data = loadData();
  data.relationships = data.relationships.filter(
    (r) => !(r.type === 'partner' && (r.person_a_id === personId || r.person_b_id === personId))
  );
  if (partnerId) {
    data.relationships.push(createEdge(personId, partnerId, 'partner', 'partner', 'partner'));
  }
  saveData(data);
}

function addChildRelationInternal(
  data: FamilyData,
  parentId: PersonId,
  childId: PersonId,
  includePartnerAsCoParent = true
) {
  const parent = data.people.find((p) => p.id === parentId);
  const child = data.people.find((p) => p.id === childId);
  if (!parent || !child || parentId === childId) return;

  const parentRole: 'mother' | 'dad' = parent.sex === 'female' ? 'mother' : 'dad';
  // keep only one edge per parent role for this child
  data.relationships = data.relationships.filter(
    (r) => !(r.type === 'parent' && r.person_b_id === childId && r.role_a === parentRole)
  );
  data.relationships.push(createEdge(parentId, childId, 'parent', parentRole, 'child'));

  if (includePartnerAsCoParent) {
    const partnerEdge = data.relationships.find(
      (r) => r.type === 'partner' && (r.person_a_id === parentId || r.person_b_id === parentId)
    );
    if (partnerEdge) {
      const partnerId = partnerEdge.person_a_id === parentId ? partnerEdge.person_b_id : partnerEdge.person_a_id;
      const partner = data.people.find((p) => p.id === partnerId);
      if (partner) {
        const partnerRole: 'mother' | 'dad' = partner.sex === 'female' ? 'mother' : 'dad';
        data.relationships = data.relationships.filter(
          (r) => !(r.type === 'parent' && r.person_b_id === childId && r.role_a === partnerRole)
        );
        data.relationships.push(createEdge(partnerId, childId, 'parent', partnerRole, 'child'));
      }
    }
  }
}

export function addChildRelation(parentId: PersonId, childId: PersonId, includePartnerAsCoParent = true) {
  const data = loadData();
  addChildRelationInternal(data, parentId, childId, includePartnerAsCoParent);
  saveData(data);
}

export function addChildRelations(parentId: PersonId, childIds: PersonId[], includePartnerAsCoParent = true) {
  const data = loadData();
  childIds.forEach((childId) => addChildRelationInternal(data, parentId, childId, includePartnerAsCoParent));
  saveData(data);
}

export function deletePerson(id: string): boolean {
  const data = loadData();
  const index = data.people.findIndex((p) => p.id === id);
  if (index === -1) return false;
  data.people.splice(index, 1);
  data.relationships = data.relationships.filter(
    (r) => r.person_a_id !== id && r.person_b_id !== id
  );
  saveData(data);
  return true;
}
