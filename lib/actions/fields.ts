"use server";

import { asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fieldMerges, fields } from "@/lib/db/schema";

export type FieldComponent = { id: number; number: number };

export type FieldWithComponents = {
  id: number;
  number: number;
  sizeHa: number;
  purchaseCost: number;
  components: FieldComponent[];
};

export type FieldInput = {
  number: number;
  sizeHa: number;
  purchaseCost: number;
  sourceFieldIds: number[];
};

function normalizeSourceIds(
  fieldId: number | null,
  sourceFieldIds: number[],
): number[] {
  const unique = [...new Set(sourceFieldIds.filter((id) => id !== fieldId))];
  return unique;
}

function assertSources(sourceFieldIds: number[]) {
  if (sourceFieldIds.length === 0) return;
  if (sourceFieldIds.length < 2) {
    throw new Error("A merged field needs at least two source fields");
  }
}

export async function listFields(): Promise<FieldWithComponents[]> {
  const allFields = await db.select().from(fields).orderBy(asc(fields.number));
  if (allFields.length === 0) return [];

  const merges = await db
    .select({
      mergedFieldId: fieldMerges.mergedFieldId,
      sourceId: fields.id,
      sourceNumber: fields.number,
    })
    .from(fieldMerges)
    .innerJoin(fields, eq(fieldMerges.sourceFieldId, fields.id))
    .orderBy(asc(fields.number));

  const byMerged = new Map<number, FieldComponent[]>();
  for (const row of merges) {
    const list = byMerged.get(row.mergedFieldId) ?? [];
    list.push({ id: row.sourceId, number: row.sourceNumber });
    byMerged.set(row.mergedFieldId, list);
  }

  return allFields.map((field) => ({
    id: field.id,
    number: field.number,
    sizeHa: field.sizeHa,
    purchaseCost: field.purchaseCost,
    components: byMerged.get(field.id) ?? [],
  }));
}

export async function createField(input: FieldInput) {
  const sourceFieldIds = normalizeSourceIds(null, input.sourceFieldIds);
  assertSources(sourceFieldIds);

  if (sourceFieldIds.length > 0) {
    const existing = await db
      .select({ id: fields.id })
      .from(fields)
      .where(inArray(fields.id, sourceFieldIds));
    if (existing.length !== sourceFieldIds.length) {
      throw new Error("One or more source fields do not exist");
    }
  }

  db.transaction((tx) => {
    const inserted = tx
      .insert(fields)
      .values({
        number: input.number,
        sizeHa: input.sizeHa,
        purchaseCost: input.purchaseCost,
      })
      .returning({ id: fields.id })
      .get();

    if (sourceFieldIds.length > 0) {
      tx.insert(fieldMerges)
        .values(
          sourceFieldIds.map((sourceFieldId) => ({
            mergedFieldId: inserted.id,
            sourceFieldId,
          })),
        )
        .run();
    }
  });

  revalidatePath("/fields");
  revalidatePath("/harvests");
}

export async function updateField(id: number, input: FieldInput) {
  const sourceFieldIds = normalizeSourceIds(id, input.sourceFieldIds);
  assertSources(sourceFieldIds);

  if (sourceFieldIds.length > 0) {
    const existing = await db
      .select({ id: fields.id })
      .from(fields)
      .where(inArray(fields.id, sourceFieldIds));
    if (existing.length !== sourceFieldIds.length) {
      throw new Error("One or more source fields do not exist");
    }
  }

  db.transaction((tx) => {
    tx.update(fields)
      .set({
        number: input.number,
        sizeHa: input.sizeHa,
        purchaseCost: input.purchaseCost,
      })
      .where(eq(fields.id, id))
      .run();

    tx.delete(fieldMerges).where(eq(fieldMerges.mergedFieldId, id)).run();

    if (sourceFieldIds.length > 0) {
      tx.insert(fieldMerges)
        .values(
          sourceFieldIds.map((sourceFieldId) => ({
            mergedFieldId: id,
            sourceFieldId,
          })),
        )
        .run();
    }
  });

  revalidatePath("/fields");
  revalidatePath("/harvests");
}

export async function deleteField(id: number) {
  await db.delete(fields).where(eq(fields.id, id));
  revalidatePath("/fields");
  revalidatePath("/harvests");
}
