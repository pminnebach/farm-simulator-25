"use server";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fields, harvestFields, harvestSales, harvests } from "@/lib/db/schema";

export type HarvestFieldRef = {
  id: number;
  number: number;
  sizeHa: number;
};

export type HarvestSaleRow = {
  id: number;
  liters: number;
  saleAmount: number;
};

export type HarvestRow = {
  id: number;
  sortOrder: number;
  cropType: string | null;
  liters: number | null;
  saleAmount: number | null;
  soldLiters: number;
  wagePayment: number | null;
  vehicleLeasingCost: number | null;
  fertilizerCost: number | null;
  seedCost: number | null;
  fuelCost: number | null;
  fields: HarvestFieldRef[];
  sales: HarvestSaleRow[];
};

export type HarvestInput = {
  fieldIds: number[];
  cropType: string | null;
  liters: number | null;
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
  const rows = await db
    .select()
    .from(harvests)
    .orderBy(asc(harvests.sortOrder));

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

  const sales = await db
    .select()
    .from(harvestSales)
    .where(inArray(harvestSales.harvestId, harvestIds))
    .orderBy(asc(harvestSales.id));

  const fieldsByHarvest = new Map<number, HarvestFieldRef[]>();
  for (const link of links) {
    const list = fieldsByHarvest.get(link.harvestId) ?? [];
    list.push({ id: link.id, number: link.number, sizeHa: link.sizeHa });
    fieldsByHarvest.set(link.harvestId, list);
  }

  for (const list of fieldsByHarvest.values()) {
    list.sort((a, b) => a.number - b.number);
  }

  const salesByHarvest = new Map<number, HarvestSaleRow[]>();
  for (const sale of sales) {
    const list = salesByHarvest.get(sale.harvestId) ?? [];
    list.push({
      id: sale.id,
      liters: sale.liters,
      saleAmount: sale.saleAmount,
    });
    salesByHarvest.set(sale.harvestId, list);
  }

  return rows.map((row) => {
    const harvestSaleRows = salesByHarvest.get(row.id) ?? [];
    const soldLiters = harvestSaleRows.reduce((sum, s) => sum + s.liters, 0);
    const saleAmount =
      harvestSaleRows.length === 0
        ? null
        : harvestSaleRows.reduce((sum, s) => sum + s.saleAmount, 0);

    return {
      id: row.id,
      sortOrder: row.sortOrder,
      cropType: row.cropType,
      liters: row.liters,
      saleAmount,
      soldLiters,
      wagePayment: row.wagePayment,
      vehicleLeasingCost: row.vehicleLeasingCost,
      fertilizerCost: row.fertilizerCost,
      seedCost: row.seedCost,
      fuelCost: row.fuelCost,
      fields: fieldsByHarvest.get(row.id) ?? [],
      sales: harvestSaleRows,
    };
  });
}

export async function createHarvest(input: HarvestInput) {
  const [maxRow] = await db
    .select({ sortOrder: harvests.sortOrder })
    .from(harvests)
    .orderBy(desc(harvests.sortOrder))
    .limit(1);
  const sortOrder = (maxRow?.sortOrder ?? -1) + 1;

  const [created] = await db
    .insert(harvests)
    .values({ ...harvestValues(input), sortOrder })
    .returning({ id: harvests.id });

  await setHarvestFields(created.id, input.fieldIds);
  revalidatePath("/harvests");
}

export async function reorderHarvests(orderedIds: number[]) {
  // better-sqlite3 transactions are sync
  db.transaction((tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      tx.update(harvests)
        .set({ sortOrder: i })
        .where(eq(harvests.id, orderedIds[i]))
        .run();
    }
  });
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

export type HarvestCostDeltas = {
  wagePayment?: number | null;
  vehicleLeasingCost?: number | null;
  fertilizerCost?: number | null;
  seedCost?: number | null;
  fuelCost?: number | null;
};

export async function addHarvestCosts(id: number, deltas: HarvestCostDeltas) {
  const [row] = await db.select().from(harvests).where(eq(harvests.id, id));
  if (!row) return;

  const add = (current: number | null, delta: number | null | undefined) =>
    delta == null ? current : (current ?? 0) + delta;

  await db
    .update(harvests)
    .set({
      wagePayment: add(row.wagePayment, deltas.wagePayment),
      vehicleLeasingCost: add(row.vehicleLeasingCost, deltas.vehicleLeasingCost),
      fertilizerCost: add(row.fertilizerCost, deltas.fertilizerCost),
      seedCost: add(row.seedCost, deltas.seedCost),
      fuelCost: add(row.fuelCost, deltas.fuelCost),
    })
    .where(eq(harvests.id, id));
  revalidatePath("/harvests");
}

export async function createHarvestSale(
  harvestId: number,
  input: { liters: number; saleAmount: number },
) {
  await db.insert(harvestSales).values({
    harvestId,
    liters: input.liters,
    saleAmount: input.saleAmount,
  });
  revalidatePath("/harvests");
}

export async function deleteHarvestSale(id: number) {
  await db.delete(harvestSales).where(eq(harvestSales.id, id));
  revalidatePath("/harvests");
}

export async function deleteHarvest(id: number) {
  await db.delete(harvests).where(eq(harvests.id, id));
  revalidatePath("/harvests");
}
