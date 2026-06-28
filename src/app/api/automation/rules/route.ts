// src/app/api/automation/rules/route.ts
// BrotherFit Admin — Automation Rules API (Firebase)

import { NextRequest, NextResponse } from 'next/server';
import {
  collection, doc, addDoc, getDocs, updateDoc,
  deleteDoc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// GET — সব rules
export async function GET() {
  try {
    const snap = await getDocs(
      query(collection(db, 'automation_rules'), orderBy('priority', 'desc'))
    );
    const rules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ rules, total: rules.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — নতুন rule তৈরি
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ref = await addDoc(collection(db, 'automation_rules'), {
      ...body,
      createdAt: serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — rule update
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await updateDoc(doc(db, 'automation_rules', id), updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — rule delete
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteDoc(doc(db, 'automation_rules', id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
