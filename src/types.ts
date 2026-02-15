export type PersonId = string;
export type Sex = 'male' | 'female' | 'other' | 'unknown';
export type RelationshipType = 'parent' | 'partner';
export type RelationshipDirection = 'directed';
export type RelationshipRoleName = 'mother' | 'dad' | 'child' | 'husband' | 'wife' | 'partner';

export interface Person {
  id: PersonId;
  firstName: string;
  middleName: string;
  surname: string;
  birthDate: string;
  city: string;
  sex: Sex;
  deathDate?: string;
  photo?: string; // data URL or external URL
  notes?: string;
  /** At most one person in the tree should be true (the current user / "You") */
  isCurrentUser?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipVertex {
  id: string;
  person_a_id: PersonId;
  person_b_id: PersonId;
  type: RelationshipType;
  direction: RelationshipDirection;
  role_a: RelationshipRoleName;
  role_b: RelationshipRoleName;
  createdAt: string;
}

export interface FamilyData {
  people: Person[];
  relationships: RelationshipVertex[];
}

export type RelationshipRole = 'mother' | 'father' | 'partner';

export const RELATIONSHIP_LABELS: Record<RelationshipRole, string> = {
  mother: 'Mother',
  father: 'Father',
  partner: 'Partner',
};
