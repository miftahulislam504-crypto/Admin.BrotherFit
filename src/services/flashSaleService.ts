import {
  collection, getDocs, query, orderBy, doc,
  addDoc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { fromDoc } from '@/lib/firebase/helpers';
import type { FlashSale, Product } from '@/types';

export async function getFlashSales(): Promise<FlashSale[]> {
  const snap = await getDocs(query(collection(db, 'flashSales'), orderBy('startTime', 'desc')));
  return snap.docs.map(d => fromDoc<FlashSale>(d));
}

export async function upsertFlashSale(data: Partial<FlashSale> & { id?: string }): Promise<string> {
  if (data.id) {
    const { id, ...rest } = data;
    await updateDoc(doc(db, 'flashSales', id), rest);
    return id;
  }
  const ref = await addDoc(collection(db, 'flashSales'), data);
  return ref.id;
}

export async function deleteFlashSale(id: string): Promise<void> {
  await deleteDoc(doc(db, 'flashSales', id));
}

/** Lightweight product list for the picker (id + name + image + price) */
export async function getProductPickerList(): Promise<Pick<Product,'id'|'name'|'images'|'basePrice'|'salePrice'>[]> {
  const snap = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
  return snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, name: data.name, images: data.images ?? [], basePrice: data.basePrice, salePrice: data.salePrice };
  });
}
