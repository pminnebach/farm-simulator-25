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
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FieldWithComponents } from "@/lib/actions/fields";
import {
  addHarvestCosts,
  createHarvest,
  deleteHarvest,
  type HarvestRow,
  reorderHarvests,
  updateHarvest,
} from "@/lib/actions/harvests";
import { CROP_TYPES } from "@/lib/crops";

type SortKey = "order" | "id" | "crop";
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

type CostFormValues = {
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

const emptyCostForm: CostFormValues = {
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
  if (key === "order") return (a.sortOrder - b.sortOrder) * sign;
  if (key === "id") return (a.id - b.id) * sign;
  const aCrop = a.cropType ?? "";
  const bCrop = b.cropType ?? "";
  if (!aCrop && bCrop) return 1;
  if (aCrop && !bCrop) return -1;
  return aCrop.localeCompare(bCrop) * sign;
}

function moveRow(rows: HarvestRow[], fromId: number, toId: number) {
  const from = rows.findIndex((r) => r.id === fromId);
  const to = rows.findIndex((r) => r.id === toId);
  if (from < 0 || to < 0 || from === to) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function HarvestsManager({
  harvests,
  fields,
}: {
  harvests: HarvestRow[];
  fields: FieldWithComponents[];
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [costsOpened, { open: openCosts, close: closeCosts }] =
    useDisclosure(false);
  const [editing, setEditing] = useState<HarvestRow | null>(null);
  const [addingCosts, setAddingCosts] = useState<HarvestRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(harvests);
  const [dragId, setDragId] = useState<number | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "order",
    dir: "asc",
  });

  useEffect(() => {
    setRows(harvests);
  }, [harvests]);

  const canDrag = sort.key === "order";

  const fieldOptions = fields.map((f) => ({
    value: String(f.id),
    label: fieldLabel(f),
  }));

  const form = useForm<FormValues>({
    initialValues: emptyForm,
  });

  const costForm = useForm<CostFormValues>({
    initialValues: emptyCostForm,
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

  function openAddCosts(row: HarvestRow) {
    setAddingCosts(row);
    costForm.setValues(emptyCostForm);
    openCosts();
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

  function handleAddCosts(values: CostFormValues) {
    if (!addingCosts) return;
    startTransition(async () => {
      await addHarvestCosts(addingCosts.id, {
        wagePayment: parseOptionalAmount(values.wagePayment),
        vehicleLeasingCost: parseOptionalAmount(values.vehicleLeasingCost),
        fertilizerCost: parseOptionalAmount(values.fertilizerCost),
        seedCost: parseOptionalAmount(values.seedCost),
        fuelCost: parseOptionalAmount(values.fuelCost),
      });
      closeCosts();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this harvest?")) return;
    startTransition(async () => {
      await deleteHarvest(id);
    });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (key === "order") return { key: "order", dir: "asc" };
      return prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" };
    });
  }

  function handleDrop(targetId: number) {
    const fromId = dragIdRef.current;
    if (fromId == null || fromId === targetId || !canDrag) return;
    const next = moveRow(rows, fromId, targetId);
    setRows(next);
    dragIdRef.current = null;
    setDragId(null);
    startTransition(async () => {
      await reorderHarvests(next.map((r) => r.id));
    });
  }

  const totals = rows.reduce(
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

  const sorted =
    sort.key === "order"
      ? rows
      : [...rows].sort((a, b) => compareHarvests(a, b, sort.key, sort.dir));

  const tableRows = sorted.map((row) => (
    <Table.Tr
      key={row.id}
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        e.dataTransfer.setData("text/plain", String(row.id));
        e.dataTransfer.effectAllowed = "move";
        dragIdRef.current = row.id;
        setDragId(row.id);
      }}
      onDragOver={(e) => {
        if (!canDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        handleDrop(row.id);
      }}
      onDragEnd={() => {
        dragIdRef.current = null;
        setDragId(null);
      }}
      style={{
        opacity: dragId === row.id ? 0.5 : 1,
        cursor: canDrag ? "grab" : undefined,
      }}
    >
      <Table.Td w={36} style={{ verticalAlign: "middle" }}>
        {canDrag ? (
          <GripVertical size={16} aria-label="Drag to reorder" />
        ) : null}
      </Table.Td>
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
            onClick={() => openAddCosts(row)}
          >
            Add costs
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
        <Group>
          {sort.key !== "order" && (
            <Button variant="default" onClick={() => toggleSort("order")}>
              Manual order
            </Button>
          )}
          <Button onClick={openCreate}>Add harvest</Button>
        </Group>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={36} />
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
          {tableRows.length > 0 ? (
            tableRows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={14}>
                <Text c="dimmed" ta="center" py="lg">
                  No harvests yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
        {rows.length > 0 && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Td />
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

      <Modal
        opened={costsOpened}
        onClose={closeCosts}
        title="Add costs"
        size="md"
      >
        <form onSubmit={costForm.onSubmit(handleAddCosts)}>
          <Stack>
            <NumberInput
              label={`Wage payment (€) — current ${formatMoney(addingCosts?.wagePayment ?? null)}`}
              min={0}
              decimalScale={2}
              {...costForm.getInputProps("wagePayment")}
            />
            <NumberInput
              label={`Vehicle leasing cost (€) — current ${formatMoney(addingCosts?.vehicleLeasingCost ?? null)}`}
              min={0}
              decimalScale={2}
              {...costForm.getInputProps("vehicleLeasingCost")}
            />
            <NumberInput
              label={`Fertilizer cost (€) — current ${formatMoney(addingCosts?.fertilizerCost ?? null)}`}
              min={0}
              decimalScale={2}
              {...costForm.getInputProps("fertilizerCost")}
            />
            <NumberInput
              label={`Seed cost (€) — current ${formatMoney(addingCosts?.seedCost ?? null)}`}
              min={0}
              decimalScale={2}
              {...costForm.getInputProps("seedCost")}
            />
            <NumberInput
              label={`Fuel cost (€) — current ${formatMoney(addingCosts?.fuelCost ?? null)}`}
              min={0}
              decimalScale={2}
              {...costForm.getInputProps("fuelCost")}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeCosts}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Add costs
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
