import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/config/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

/**
 * One-time migration: moves strengths, areasForDevelopment, and performanceGrade
 * from `mas/{id}` into `maConfidential/{id}` so participants cannot read them.
 * Safe to run multiple times — skips MAs that already have a confidential doc.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let uid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const db = adminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const masSnap = await db.collection("mas").get();
    const results: { name: string; status: string }[] = [];

    for (const maDoc of masSnap.docs) {
      const data = maDoc.data();
      const name = (data.name ?? "") as string;

      // Extract sensitive fields
      const strengths = Array.isArray(data.strengths) ? data.strengths : null;
      const areasForDevelopment = Array.isArray(data.areasForDevelopment) ? data.areasForDevelopment : null;
      const rotations = Array.isArray(data.rotations) ? data.rotations : [];

      const rotationGrades: Record<string, string | null> = {};
      for (const r of rotations as { label: string; performanceGrade?: string | null }[]) {
        rotationGrades[r.label] = r.performanceGrade ?? null;
      }

      const hasAnySensitiveData = strengths || areasForDevelopment || Object.values(rotationGrades).some(Boolean);

      // Write to maConfidential
      await db.collection("maConfidential").doc(maDoc.id).set(
        { strengths, areasForDevelopment, rotationGrades },
        { merge: true }
      );

      // Strip sensitive fields from mas — write clean rotations array + delete top-level fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const cleanRotations = rotations.map(({ performanceGrade: _g, ...rest }: Record<string, unknown>) => rest);
      await maDoc.ref.update({
        rotations: cleanRotations,
        strengths: FieldValue.delete(),
        areasForDevelopment: FieldValue.delete(),
      });

      results.push({ name, status: hasAnySensitiveData ? "migrated" : "cleaned" });
    }

    return NextResponse.json({ migrated: results.filter((r) => r.status === "migrated").length, results });
  } catch (err) {
    console.error("Migration error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
