"use client";

import type { PostgrestError } from "@supabase/supabase-js";

type PageQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/** Fetches every row of a query, page by page (PostgREST caps rows per request). */
export async function fetchAll<T>(query: PageQuery<T>, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
