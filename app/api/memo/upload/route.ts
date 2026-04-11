import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/config/firebaseAdmin";
import { uploadToSupabase } from "@/lib/supabaseStorage";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Verify Firebase ID token
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 2. Load user role from Firestore
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }
  const user = userSnap.data() as { role: string; maId?: string | null };

  // 3. Parse form data
  const formData = await req.formData();
  const maId = formData.get("maId");
  const file = formData.get("file");

  if (typeof maId !== "string" || !maId) {
    return NextResponse.json({ error: "Missing maId" }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // 4. Permission check: admin can upload for anyone; MA can only upload for their own maId
  const isAdmin = user.role === "admin";
  const isOwningMa = user.role === "ma" && user.maId === maId;
  if (!isAdmin && !isOwningMa) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Upload to Supabase Storage and return the public URL
  const buffer = Buffer.from(await file.arrayBuffer());

  let memoURL: string;
  try {
    memoURL = await uploadToSupabase(maId, buffer);
  } catch (e) {
    console.error("Supabase upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ memoURL });
}
