"use client";

import { downloadText, toCSV } from "./csv";
import { minorToInput } from "./money";
import { paymentMethodLabel } from "./labels";
import type { Category, Profile, Transaction } from "./types";

/** CSV of already-authorized transactions (RLS decided what is in `rows`). */
export function exportTransactionsCSV(rows: Transaction[], categories: Category[], members: Profile[], filename: string) {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const who = new Map(members.map((m) => [m.id, m.display_name]));
  const csv = toCSV(rows, [
    { header: "التاريخ", value: (r) => r.occurred_on },
    { header: "المبلغ (د.إ)", value: (r) => minorToInput(r.amount_minor) },
    { header: "التصنيف", value: (r) => cat.get(r.category_id) ?? "" },
    { header: "الوصف", value: (r) => r.description ?? "" },
    { header: "النوع", value: (r) => (r.visibility === "shared" ? "مشترك" : "خاص") },
    { header: "أضافه", value: (r) => who.get(r.owner_id) ?? "" },
    { header: "طريقة الدفع", value: (r) => paymentMethodLabel(r.payment_method) },
  ]);
  downloadText(filename, csv);
}
