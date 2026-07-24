"use client";

import {
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useTransition } from "react";
import type { FieldWithComponents } from "@/lib/actions/fields";
import {
  createHarvest,
  deleteHarvest,
  type HarvestRow,
  updateHarvest,
} from "@/lib/actions/harvests";
import { CROP_TYPES } from "@/lib/crops";

type SortKey = "id" | "crop";
type SortDir = "asc" | "desc";

type FormValues = {
  fieldIds: string[];
  cropType: string | null;
  liters: number | string;
  saleAmount: number | string;
  wagePayment: number | string;
  vehicleLeasingCost: number | string;
  fertilizerCost: number | string;
  seedCost: number | string;
  fuelCost: number | string;
};

const emptyForm: FormValues = {
  fieldIds: [],
  cropType: null,
  liters: "",
  saleAmount: "",
  wagePayment: "",
  vehicleLeasingCost: "",
  fertilizerCost: "",
  seedCost: "",
  fuelCost: "",
};

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return `€${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPerUnit(liters: number | null, saleAmount: number | null) {
  if (saleAmount == null || liters == null || liters <= 0) return "—";
  return `${formatMoney(saleAmount / liters)}/L`;
}

function formatYield(liters: number | null, fields: HarvestRow["fields"]) {
  if (liters == null) return "—";
  const sizeHa = fields.reduce((sum, f) => sum + f.sizeHa, 0);
  if (sizeHa <= 0) return "—";
  return `${Math.round(liters / sizeHa).toLocaleString()} L/ha`;
}

function parseOptionalAmount(value: number | string): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fieldLabel(f: FieldWithComponents) {
  if (f.components.length > 0) {
    const merged = f.components.map((c) => c.number).join("+");
    return `Field #${f.number} (merged: ${merged}, ${f.sizeHa} ha)`;
  }
  return `Field #${f.number} (${f.sizeHa} ha)`;
}

function formatFieldNumbers(fields: HarvestRow["fields"]) {
  if (fields.length === 0) return "—";
  return fields.map((f) => `#${f.number}`).join(", ");
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <UnstyledButton
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <Text component="span" size="sm" fw={700}>
        {label}
      </Text>
      {active && <Icon size={14} />}
    </UnstyledButton>
  );
}

function compareHarvests(
  a: HarvestRow,
  b: HarvestRow,
  key: SortKey,
  dir: SortDir,
) {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "id") return (a.id - b.id) * sign;
  const aCrop = a.cropType ?? "";
  const bCrop = b.cropType ?? "";
  if (!aCrop && bCrop) return 1;
  if (aCrop && !bCrop) return -1;
  return aCrop.localeCompare(bCrop) * sign;
}

export function HarvestsManager({
  harvests,
  fields,
}: {
  harvests: HarvestRow[];
  fields: FieldWithComponents[];
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<HarvestRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "id",
    dir: "asc",
  });

  const fieldOptions = fields.map((f) => ({
    value: String(f.id),
    label: fieldLabel(f),
  }));

  const form = useForm<FormValues>({
    initialValues: emptyForm,
  });

  function openCreate() {
    setEditing(null);
    form.setValues(emptyForm);
    open();
  }

  function openEdit(row: HarvestRow) {
    setEditing(row);
    form.setValues({
      fieldIds: row.fields.map((f) => String(f.id)),
      cropType: row.cropType,
      liters: row.liters ?? "",
      saleAmount: row.saleAmount ?? "",
      wagePayment: row.wagePayment ?? "",
      vehicleLeasingCost: row.vehicleLeasingCost ?? "",
      fertilizerCost: row.fertilizerCost ?? "",
      seedCost: row.seedCost ?? "",
      fuelCost: row.fuelCost ?? "",
    });
    open();
  }

  function handleSubmit(values: FormValues) {
    const input = {
      fieldIds: values.fieldIds.map(Number),
      cropType: values.cropType,
      liters: parseOptionalAmount(values.liters),
      saleAmount: parseOptionalAmount(values.saleAmount),
      wagePayment: parseOptionalAmount(values.wagePayment),
      vehicleLeasingCost: parseOptionalAmount(values.vehicleLeasingCost),
      fertilizerCost: parseOptionalAmount(values.fertilizerCost),
      seedCost: parseOptionalAmount(values.seedCost),
      fuelCost: parseOptionalAmount(values.fuelCost),
    };

    startTransition(async () => {
      if (editing) {
        await updateHarvest(editing.id, input);
      } else {
        await createHarvest(input);
      }
      close();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this harvest?")) return;
    startTransition(async () => {
      await deleteHarvest(id);
    });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  const totals = harvests.reduce(
    (acc, row) => {
      acc.wagePayment += row.wagePayment ?? 0;
      acc.vehicleLeasingCost += row.vehicleLeasingCost ?? 0;
      acc.fertilizerCost += row.fertilizerCost ?? 0;
      acc.seedCost += row.seedCost ?? 0;
      acc.fuelCost += row.fuelCost ?? 0;
      acc.liters += row.liters ?? 0;
      acc.saleAmount += row.saleAmount ?? 0;
      acc.sizeHa += row.fields.reduce((sum, f) => sum + f.sizeHa, 0);
      return acc;
    },
    {
      wagePayment: 0,
      vehicleLeasingCost: 0,
      fertilizerCost: 0,
      seedCost: 0,
      fuelCost: 0,
      liters: 0,
      saleAmount: 0,
      sizeHa: 0,
    },
  );

  const totalYield =
    totals.liters > 0 && totals.sizeHa > 0
      ? `${Math.round(totals.liters / totals.sizeHa).toLocaleString()} L/ha`
      : "—";

  const sorted = [...harvests].sort((a, b) =>
    compareHarvests(a, b, sort.key, sort.dir),
  );

  const rows = sorted.map((row) => (
    <Table.Tr key={row.id}>
      <Table.Td>{row.id}</Table.Td>
      <Table.Td>{formatFieldNumbers(row.fields)}</Table.Td>
      <Table.Td>{row.cropType ?? "—"}</Table.Td>
      <Table.Td>{formatMoney(row.wagePayment)}</Table.Td>
      <Table.Td>{formatMoney(row.vehicleLeasingCost)}</Table.Td>
      <Table.Td>{formatMoney(row.fertilizerCost)}</Table.Td>
      <Table.Td>{formatMoney(row.seedCost)}</Table.Td>
      <Table.Td>{formatMoney(row.fuelCost)}</Table.Td>
      <Table.Td>
        {row.liters == null ? "—" : `${row.liters.toLocaleString()} L`}
      </Table.Td>
      <Table.Td>{formatMoney(row.saleAmount)}</Table.Td>
      <Table.Td>{formatPerUnit(row.liters, row.saleAmount)}</Table.Td>
      <Table.Td>{formatYield(row.liters, row.fields)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={() => handleDelete(row.id)}
            disabled={pending}
          >
            Delete
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Harvests</Title>
        <Button onClick={openCreate}>Add harvest</Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <SortHeader
                label="ID"
                active={sort.key === "id"}
                dir={sort.dir}
                onClick={() => toggleSort("id")}
              />
            </Table.Th>
            <Table.Th>Fields</Table.Th>
            <Table.Th>
              <SortHeader
                label="Crop"
                active={sort.key === "crop"}
                dir={sort.dir}
                onClick={() => toggleSort("crop")}
              />
            </Table.Th>
            <Table.Th>Wage</Table.Th>
            <Table.Th>Vehicle lease</Table.Th>
            <Table.Th>Fertilizer</Table.Th>
            <Table.Th>Seed</Table.Th>
            <Table.Th>Fuel</Table.Th>
            <Table.Th>Liters</Table.Th>
            <Table.Th>Sold for</Table.Th>
            <Table.Th>€/L</Table.Th>
            <Table.Th>Yield</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={13}>
                <Text c="dimmed" ta="center" py="lg">
                  No harvests yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
        {harvests.length > 0 && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Td />
              <Table.Td>
                <Text fw={700}>Total</Text>
              </Table.Td>
              <Table.Td />
              <Table.Td>
                <Text fw={700}>{formatMoney(totals.wagePayment)}</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{formatMoney(totals.vehicleLeasingCost)}</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{formatMoney(totals.fertilizerCost)}</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{formatMoney(totals.seedCost)}</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{formatMoney(totals.fuelCost)}</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{totals.liters.toLocaleString()} L</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{formatMoney(totals.saleAmount)}</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>
                  {formatPerUnit(totals.liters, totals.saleAmount)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>{totalYield}</Text>
              </Table.Td>
              <Table.Td />
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>

      <Modal
        opened={opened}
        onClose={close}
        title={editing ? "Edit harvest" : "Add harvest"}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <MultiSelect
              label="Fields"
              data={fieldOptions}
              searchable
              clearable
              {...form.getInputProps("fieldIds")}
            />
            <Select
              label="Crop type"
              data={[...CROP_TYPES]}
              searchable
              clearable
              {...form.getInputProps("cropType")}
            />
            <NumberInput
              label="Wage payment (€)"
              min={0}
              decimalScale={2}
              {...form.getInputProps("wagePayment")}
            />
            <NumberInput
              label="Vehicle leasing cost (€)"
              min={0}
              decimalScale={2}
              {...form.getInputProps("vehicleLeasingCost")}
            />
            <NumberInput
              label="Fertilizer cost (€)"
              min={0}
              decimalScale={2}
              {...form.getInputProps("fertilizerCost")}
            />
            <NumberInput
              label="Seed cost (€)"
              min={0}
              decimalScale={2}
              {...form.getInputProps("seedCost")}
            />
            <NumberInput
              label="Fuel cost (€)"
              min={0}
              decimalScale={2}
              {...form.getInputProps("fuelCost")}
            />
            <NumberInput
              label="Liters harvested"
              min={0}
              decimalScale={2}
              {...form.getInputProps("liters")}
            />
            <NumberInput
              label="Sold for (€)"
              min={0}
              decimalScale={2}
              {...form.getInputProps("saleAmount")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
