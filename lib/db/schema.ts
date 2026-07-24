import { relations } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const fields = sqliteTable("fields", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull().unique(),
  sizeHa: real("size_ha").notNull(),
  purchaseCost: real("purchase_cost").notNull(),
});

export const fieldMerges = sqliteTable(
  "field_merges",
  {
    mergedFieldId: integer("merged_field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    sourceFieldId: integer("source_field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.mergedFieldId, t.sourceFieldId] })],
);

export const harvests = sqliteTable("harvests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cropType: text("crop_type"),
  liters: real("liters"),
  saleAmount: real("sale_amount"),
  wagePayment: real("wage_payment"),
  vehicleLeasingCost: real("vehicle_leasing_cost"),
  fertilizerCost: real("fertilizer_cost"),
  seedCost: real("seed_cost"),
  fuelCost: real("fuel_cost"),
});

export const harvestFields = sqliteTable(
  "harvest_fields",
  {
    harvestId: integer("harvest_id")
      .notNull()
      .references(() => harvests.id, { onDelete: "cascade" }),
    fieldId: integer("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.harvestId, t.fieldId] })],
);

export const fieldsRelations = relations(fields, ({ many }) => ({
  harvestFields: many(harvestFields),
  components: many(fieldMerges, { relationName: "mergedField" }),
  usedInMerges: many(fieldMerges, { relationName: "sourceField" }),
}));

export const fieldMergesRelations = relations(fieldMerges, ({ one }) => ({
  mergedField: one(fields, {
    fields: [fieldMerges.mergedFieldId],
    references: [fields.id],
    relationName: "mergedField",
  }),
  sourceField: one(fields, {
    fields: [fieldMerges.sourceFieldId],
    references: [fields.id],
    relationName: "sourceField",
  }),
}));

export const harvestsRelations = relations(harvests, ({ many }) => ({
  fields: many(harvestFields),
}));

export const harvestFieldsRelations = relations(harvestFields, ({ one }) => ({
  harvest: one(harvests, {
    fields: [harvestFields.harvestId],
    references: [harvests.id],
  }),
  field: one(fields, {
    fields: [harvestFields.fieldId],
    references: [fields.id],
  }),
}));

export type Field = typeof fields.$inferSelect;
export type FieldMerge = typeof fieldMerges.$inferSelect;
export type Harvest = typeof harvests.$inferSelect;
export type HarvestField = typeof harvestFields.$inferSelect;
