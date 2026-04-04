import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/config/firebase";

/** One PDF per MA — fixed object path so re-uploads replace the same key. */
export function getMemoStorageRef(maId: string) {
  return ref(storage, `memos/${maId}.pdf`);
}

/**
 * Deletes the existing memo object if present (ignores not-found).
 * TODO: Tighten Storage rules so only admins / the owning MA can write `memos/{maId}.pdf`.
 */
export async function deleteMemoIfExists(maId: string): Promise<void> {
  const r = getMemoStorageRef(maId);
  try {
    await deleteObject(r);
  } catch {
    // Object may not exist yet
  }
}

export async function uploadMemoPdf(maId: string, file: File): Promise<string> {
  await deleteMemoIfExists(maId);
  const r = getMemoStorageRef(maId);
  await uploadBytes(r, file, { contentType: file.type || "application/pdf" });
  return getDownloadURL(r);
}
