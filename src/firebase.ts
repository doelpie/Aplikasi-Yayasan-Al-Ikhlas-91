import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import rawConfig from '../firebase-applet-config.json';
import { Member, AppNotification } from './types';
import { INITIAL_MEMBERS } from './data/initialData';

// Support VITE_ environment variables (safe for git/production) with local fallback
export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || rawConfig?.apiKey || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || rawConfig?.authDomain || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || rawConfig?.projectId || '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || rawConfig?.storageBucket || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || rawConfig?.messagingSenderId || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || rawConfig?.appId || '',
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || rawConfig?.firestoreDatabaseId || '',
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with explicit database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Error Handling Definition
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore connection verified successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or internet connection.');
    } else {
      console.log('Firestore connected (ping response received)');
    }
    return true;
  }
}
testConnection();

// Collection paths
const MEMBERS_COLLECTION = 'members';
const NOTIFICATIONS_COLLECTION = 'notifications';

// Clean object to avoid undefined fields in Firestore
function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// Seed initial members if database is empty
export async function seedInitialDataIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    if (snap.empty) {
      console.log('Seeding initial members to Firestore...');
      for (const m of INITIAL_MEMBERS) {
        await setDoc(doc(db, MEMBERS_COLLECTION, m.id), cleanForFirestore(m));
      }
      console.log('Seeding initial members completed.');
    }
  } catch (error) {
    console.warn('Initial seeding note:', error);
  }
}

// Fetch all members from Firestore
export async function fetchMembersFromFirestore(): Promise<Member[]> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    if (snap.empty) {
      await seedInitialDataIfEmpty();
      return INITIAL_MEMBERS;
    }
    const list: Member[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Member);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MEMBERS_COLLECTION);
  }
}

// Save or Update a member in Firestore
export async function saveMemberToFirestore(member: Member): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${member.id}`;
  try {
    await setDoc(doc(db, MEMBERS_COLLECTION, member.id), cleanForFirestore(member), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete a member from Firestore
export async function deleteMemberFromFirestore(id: string): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, MEMBERS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Real-time listener for Members
export function subscribeMembersFirestore(
  onUpdate: (members: Member[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = MEMBERS_COLLECTION;
  const colRef = collection(db, path);
  
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const list: Member[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Member);
      });
      onUpdate(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Real-time listener for Notifications
export function subscribeNotificationsFirestore(
  onUpdate: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = NOTIFICATIONS_COLLECTION;
  const q = query(collection(db, path), orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as AppNotification);
      });
      onUpdate(list);
    },
    (error) => {
      // Fallback query without orderBy in case index is pending
      const fallbackCol = collection(db, path);
      return onSnapshot(
        fallbackCol,
        (snap) => {
          const list: AppNotification[] = [];
          snap.forEach(docSnap => list.push(docSnap.data() as AppNotification));
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onUpdate(list);
        },
        (err2) => {
          onError?.(err2);
          handleFirestoreError(err2, OperationType.LIST, path);
        }
      );
    }
  );
}

// Add a Notification to Firestore
export async function addNotificationToFirestore(notif: AppNotification): Promise<void> {
  const path = `${NOTIFICATIONS_COLLECTION}/${notif.id}`;
  try {
    await setDoc(doc(db, NOTIFICATIONS_COLLECTION, notif.id), cleanForFirestore(notif));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Mark Notification as read in Firestore
export async function markNotificationAsReadInFirestore(id: string): Promise<void> {
  const path = `${NOTIFICATIONS_COLLECTION}/${id}`;
  try {
    await setDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Mark all Notifications as read in Firestore
export async function markAllNotificationsAsReadInFirestore(notifications: AppNotification[]): Promise<void> {
  for (const n of notifications) {
    if (!n.read) {
      try {
        await setDoc(doc(db, NOTIFICATIONS_COLLECTION, n.id), { read: true }, { merge: true });
      } catch (err) {
        console.warn('Error marking notification as read:', err);
      }
    }
  }
}
