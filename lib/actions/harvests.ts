"use server";

import { asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fields, harvestFields, harvests } from "@/lib/db/schema";

export type HarvestFieldRef = {
  id: number;
  number: number;
  sizeHa: number;
};

export type HarvestRow = {
  id: number;
  cropType: string | null;
  liters: number | null;
  saleAmount: number | null;
  wagePayment: number | null;
  vehicleLeasingCost: number | null;
  fertilizerCost: number | null;
  seedCost: number | null;
  fuelCost: number | null;
  fields: HarvestFieldRef[];
};

export type HarvestInput = {
  fieldIds: number[];
  cropType: string | null;
  liters: number | null;
  saleAmount: number | null;
  wagePayment: number | null;
  vehicleLeasingCost: number | null;
  fertilizerCost: number | null;
  seedCost: number | null;
  fuelCost: number | null;
};

function harvestValues(input: HarvestInput) {
  return {
    cropType: input.cropType,
    liters: input.liters,
    saleAmount: input.saleAmount,
    wagePayment: input.wagePayment,
    vehicleLeasingCost: input.vehicleLeasingCost,
    fertilizerCost: input.fertilizerCost,
    seedCost: input.seedCost,
    fuelCost: input.fuelCost,
  };
}

async function setHarvestFields(harvestId: number, fieldIds: number[]) {
  await db.delete(harvestFields).where(eq(harvestFields.harvestId, harvestId));

  const uniqueIds = [...new Set(fieldIds)];
  if (uniqueIds.length === 0) return;

  await db
    .insert(harvestFields)
    .values(uniqueIds.map((fieldId) => ({ harvestId, fieldId })));
}

export async function listHarvests(): Promise<HarvestRow[]> {
  const rows = await db.select().from(harvests).orderBy(asc(harvests.id));

  if (rows.length === 0) return [];

  const harvestIds = rows.map((r) => r.id);
  const links = await db
    .select({
      harvestId: harvestFields.harvestId,
      id: fields.id,
      number: fields.number,
      sizeHa: fields.sizeHa,
    })
    .from(harvestFields)
    .innerJoin(fields, eq(harvestFields.fieldId, fields.id))
    .where(inArray(harvestFields.harvestId, harvestIds));

  const fieldsByHarvest = new Map<number, HarvestFieldRef[]>();
  for (const link of links) {
    const list = fieldsByHarvest.get(link.harvestId) ?? [];
    list.push({ id: link.id, number: link.number, sizeHa: link.sizeHa });
    fieldsByHarvest.set(link.harvestId, list);
  }

  for (const list of fieldsByHarvest.values()) {
    list.sort((a, b) => a.number - b.number);
  }

  return rows.map((row) => ({
    id: row.id,
    cropType: row.cropType,
    liters: row.liters,
    saleAmount: row.saleAmount,
    wagePayment: row.wagePayment,
    vehicleLeasingCost: row.vehicleLeasingCost,
    fertilizerCost: row.fertilizerCost,
    seedCost: row.seedCost,
    fuelCost: row.fuelCost,
    fields: fieldsByHarvest.get(row.id) ?? [],
  }));
}

export async function createHarvest(input: HarvestInput) {
  const [created] = await db
    .insert(harvests)
    .values(harvestValues(input))
    .returning({ id: harvests.id });

  await setHarvestFields(created.id, input.fieldIds);
  revalidatePath("/harvests");
}

export async function updateHarvest(id: number, input: HarvestInput) {
  await db
    .update(harvests)
    .set(harvestValues(input))
    .where(eq(harvests.id, id));
  await setHarvestFields(id, input.fieldIds);
  revalidatePath("/harvests");
}

export async function deleteHarvest(id: number) {
  await db.delete(harvests).where(eq(harvests.id, id));
  revalidatePath("/harvests");
}
