"use client";

import { getSupabase } from "./supabase/client";
import { uuid } from "./utils";

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

/** Downscales large photos to JPEG (~1600px) before upload. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadReceipt(householdId: string, transactionId: string, file: File) {
  const sb = getSupabase();
  const body = await compress(file);
  const mime = body.type || file.type;
  if (!ALLOWED.includes(mime)) throw new Error("unsupported_receipt_type");
  if (body.size > RECEIPT_MAX_BYTES) throw new Error("receipt_too_large");
  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
  const path = `${householdId}/${transactionId}/${uuid()}.${ext}`;
  const up = await sb.storage.from("receipts").upload(path, body, { contentType: mime, upsert: false });
  if (up.error) throw up.error;
  const ins = await sb.from("receipt_attachments").insert({ transaction_id: transactionId, storage_path: path, mime_type: mime, size_bytes: body.size });
  if (ins.error) {
    await sb.storage.from("receipts").remove([path]);
    throw ins.error;
  }
}

/** Short-lived signed URL; only works if RLS lets the viewer see the attachment. */
export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from("receipts").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteReceipt(id: string, path: string) {
  const sb = getSupabase();
  await sb.storage.from("receipts").remove([path]);
  const res = await sb.from("receipt_attachments").delete().eq("id", id);
  if (res.error) throw res.error;
}
