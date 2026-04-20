import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "ma" | "viewer";

export type ReactionType = "like" | "heart" | "insightful" | "confused";

/** Firestore `users` collection document */
export interface ForumUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  /** When `role` is `ma`, links this account to an `mas` document id. Set via Admin panel. */
  maId?: string | null;
  createdAt: Timestamp;
}

export type RotationLabel = "R1" | "R2" | "R3" | "R4";

export interface Rotation {
  label: RotationLabel;
  department: string;
  learningMemoUrl: string | null;
  presentationUrl: string | null;
}

/** Firestore `mas` collection document */
export interface MA {
  id: string;
  name: string;
  department: string;
  joinYear: number | null;
  photoURL: string;
  bio: string;
  hasMemo: boolean;
  memoURL: string | null;
  memoUploadedAt: Timestamp | null;
  updatedAt: Timestamp;
  order: number | null;
  isPresenting: boolean | null;
  school: string | null;
  rotations: Rotation[];
}

/** Firestore `comments` collection document */
export interface Comment {
  id: string;
  maId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: Timestamp;
  editedAt: Timestamp | null;
  isEdited: boolean;
}

/** Firestore `reactions` collection document — one doc per user per MA (`${maId}_${authorUid}`) */
export interface Reaction {
  id: string;
  maId: string;
  authorUid: string;
  type: ReactionType;
}

/** Pre-assigned role before the user signs in (processed in `ensureUserDocument`). */
export interface UserInvite {
  email: string;
  role: UserRole;
  maId?: string | null;
  createdAt: Timestamp;
}
