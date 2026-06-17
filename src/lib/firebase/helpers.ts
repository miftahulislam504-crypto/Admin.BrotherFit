import { Timestamp, DocumentSnapshot } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';

// ── Timestamp converter ────────────────────────────────────

export function convertTimestamps<T>(data: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) {
      result[k] = v.toDate();
    } else if (Array.isArray(v)) {
      result[k] = v.map(item =>
        item && typeof item === 'object'
          ? convertTimestamps(item as Record<string, unknown>)
          : item
      );
    } else {
      result[k] = v;
    }
  }
  return result as T;
}

export function fromDoc<T>(snap: DocumentSnapshot): T {
  return convertTimestamps<T>({ id: snap.id, ...snap.data() });
}

// ── Admin auth ────────────────────────────────────────────
//
// Admin status is determined by the `role` field on the user's
// own profile document at users/{uid} — NOT a separate collection.
// Expected shape: users/{uid} → { ..., role: "admin" }

export async function adminLogin(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);

  // Verify admin role
  const userDoc = await getDoc(doc(db, 'users', result.user.uid));
  if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
    await signOut(auth);
    throw new Error('ACCESS_DENIED');
  }

  return result;
}

export async function adminLogout() {
  return signOut(auth);
}

export async function checkAdminRole(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() && snap.data()?.role === 'admin';
}
