import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/config/firebaseAdmin";

export const dynamic = "force-dynamic";

const LEADERSHIP_DATA: Record<string, { strengths: string[]; areasForDevelopment: string[] }> = {
  "xia zhiyu (iris)": {
    strengths: [
      "Strong learning agility; quickly grasps workflows and collaboration norms",
      "Sharp logical thinking in analyzing root causes of issues",
      "Works independently with sound business judgment",
    ],
    areasForDevelopment: [
      "Build process-oriented thinking and stronger review skills to turn insights into actionable improvements",
      "More direct communication and greater attention to detail under heavy workload",
      "More confidence when expressing differing viewpoints",
    ],
  },
  "liu shujian (harry)": {
    strengths: [
      "Passionate gamer with strong product sense and deep game knowledge",
      "Receptive to feedback and improves quickly",
      "Early potential in game design, delivering above-junior-level output",
    ],
    areasForDevelopment: [
      "Stronger project management discipline — faster initial pace and earlier risk escalation",
      "Build confidence managing external agencies with clearer briefs and more direct communication",
    ],
  },
  "jin yingjie (joyce)": {
    strengths: [
      "Strong curiosity and proactive learning orientation; volunteers beyond core scope",
      "Quick to pick up new concepts, aided by UR and Dev background",
      "Delivers projects on time across varied workstreams",
    ],
    areasForDevelopment: [
      "Stronger ownership and accountability, particularly when direction is ambiguous",
      "Resource discipline — make clear trade-offs and not let constraints become a blocker to impact",
    ],
  },
  "yan wei": {
    strengths: [
      "Strong product thinking; insights directly contributed to hitting the 10k CCU milestone",
      "Adaptable and intellectually open; fast ramp-up across entirely unfamiliar platforms",
      "Engages fully across product analysis, user research, and advertising",
    ],
    areasForDevelopment: [
      "Sharpen execution discipline and time management; ensure initiatives are carried through to completion",
      "Narrow the gap between exploration and output — translate learnings into execution more quickly",
    ],
  },
  "zhuang yuan (mitty)": {
    strengths: [
      "Strong curiosity and exploratory drive; proactively goes beyond assigned scope",
      "Builds connections with local stakeholders and shows strong hands-on initiative",
      "Exceptional learning agility and cross-domain adaptability; quickly acquires and applies new skills",
    ],
    areasForDevelopment: [
      "Greater decisiveness and willingness to take calculated risks in ambiguous situations",
      "More confidence sharing original perspectives proactively, even when not fully formed",
    ],
  },
  "joan chin": {
    strengths: [
      "Strong sense of responsibility and genuine enthusiasm; actively explores beyond core expertise",
      "Positive attitude and strong resilience",
      "Receptive to feedback and consistently follows through on areas flagged for improvement",
    ],
    areasForDevelopment: [
      "Sharpen problem-solving and task decomposition skills to improve efficiency",
      "Build a more independent judgment system — form clearer conclusions, ask sharper questions, arrive at more decisive solutions",
    ],
  },
  "xu zhanxiao": {
    strengths: [
      "Strong cross-domain learning agility paired with genuine humility and a grounded mindset",
      "Sharp gaming instincts with clear, original thinking and well-structured logic",
    ],
    areasForDevelopment: [
      "Limited gaming industry experience — understanding of day-to-day game development and operations still surface-level",
    ],
  },
  "shang ruting": {
    strengths: [
      "Strong academic foundation in mathematics and business analytics; thinks rigorously and communicates clearly",
      "Deep passion for gaming with hands-on FPS experience, giving her a credible player perspective",
    ],
    areasForDevelopment: [
      "Tends toward individual contributor profile — leadership potential has not yet been demonstrated and warrants further assessment",
    ],
  },
  "joshua lim": {
    strengths: [
      "Extremely hardcore gamer with deep competitive knowledge translating into strong product instincts",
      "Sharp, structured thinker who cuts to root causes, contributes original ideas, and challenges others calmly",
    ],
    areasForDevelopment: [
      "Develop greater conviction in advocating for his views in the moment — learn to push for well-reasoned perspectives within discussions",
    ],
  },
  "chen haolin": {
    strengths: [
      "Analytically strong with sharp business acumen; breaks down complex problems systematically",
      "Translates deep player experience into grounded recommendations",
      "Confident and self-assured; open to challenge and quick to extend thinking when presented with new perspectives",
    ],
    areasForDevelopment: [
      "Leadership presence and ability to inspire others remain untested — worth probing in future rotations",
    ],
  },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let uid: string;
    try {
      const decoded = await adminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      console.error("Token verification failed:", e);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const firestoreDb = adminDb();
    const userSnap = await firestoreDb.collection("users").doc(uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const masSnap = await firestoreDb.collection("mas").get();
    const results: { name: string; status: string }[] = [];

    const batch = firestoreDb.batch();
    let updateCount = 0;

    for (const maDoc of masSnap.docs) {
      const name = (maDoc.data().name ?? "").trim().toLowerCase();
      const data = LEADERSHIP_DATA[name];
      if (data) {
        batch.update(maDoc.ref, {
          strengths: data.strengths,
          areasForDevelopment: data.areasForDevelopment,
        });
        results.push({ name: maDoc.data().name as string, status: "updated" });
        updateCount++;
      } else {
        results.push({ name: maDoc.data().name as string, status: "no match" });
      }
    }

    if (updateCount > 0) await batch.commit();

    return NextResponse.json({ updated: updateCount, results });
  } catch (err) {
    console.error("Seed leadership error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
