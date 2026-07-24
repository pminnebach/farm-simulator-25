"use client";

import {
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { useState, useTransition } from "react";
import {
  createField,
  deleteField,
  type FieldWithComponents,
  updateField,
} from "@/lib/actions/fields";

type FieldFormValues = {
  number: number | string;
  sizeHa: number | string;
  purchaseCost: number | string;
  isMerged: boolean;
  sourceFieldIds: string[];
};

function formatComponents(components: FieldWithComponents["components"]) {
  if (components.length === 0) return null;
  return components.map((c) => c.number).join(" + ");
}

function FieldActions({
  field,
  pending,
  onEdit,
  onDelete,
}: {
  field: FieldWithComponents;
  pending: boolean;
  onEdit: (field: FieldWithComponents) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Group gap="xs">
      <Button size="xs" variant="light" onClick={() => onEdit(field)}>
        Edit
      </Button>
      <Button
        size="xs"
        variant="light"
        color="red"
        onClick={() => onDelete(field.id)}
        disabled={pending}
      >
        Delete
      </Button>
    </Group>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <Text c="dimmed" ta="center" py="lg">
          {message}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

export function FieldsManager({ fields }: { fields: FieldWithComponents[] }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<FieldWithComponents | null>(null);
  const [pending, startTransition] = useTransition();

  const individualFields = fields.filter((f) => f.components.length === 0);
  const mergedFields = fields.filter((f) => f.components.length > 0);

  const form = useForm<FieldFormValues>({
    initialValues: {
      number: "",
      sizeHa: "",
      purchaseCost: "",
      isMerged: false,
      sourceFieldIds: [],
    },
    validate: {
      number: (v) => (Number(v) > 0 ? null : "Required"),
      sizeHa: (v) => (Number(v) > 0 ? null : "Required"),
      purchaseCost: (v) => (Number(v) >= 0 ? null : "Required"),
      sourceFieldIds: (v, values) =>
        values.isMerged && v.length < 2
          ? "Select at least two source fields"
          : null,
    },
  });

  const sourceOptions = fields
    .filter((f) => f.id !== editing?.id)
    .map((f) => ({
      value: String(f.id),
      label: `Field #${f.number} (${f.sizeHa} ha)`,
    }));

  function openCreate() {
    setEditing(null);
    form.setValues({
      number: "",
      sizeHa: "",
      purchaseCost: "",
      isMerged: false,
      sourceFieldIds: [],
    });
    open();
  }

  function openEdit(field: FieldWithComponents) {
    setEditing(field);
    form.setValues({
      number: field.number,
      sizeHa: field.sizeHa,
      purchaseCost: field.purchaseCost,
      isMerged: field.components.length > 0,
      sourceFieldIds: field.components.map((c) => String(c.id)),
    });
    open();
  }

  function handleSubmit(values: FieldFormValues) {
    const input = {
      number: Number(values.number),
      sizeHa: Number(values.sizeHa),
      purchaseCost: Number(values.purchaseCost),
      sourceFieldIds: values.isMerged ? values.sourceFieldIds.map(Number) : [],
    };
    startTransition(async () => {
      if (editing) {
        await updateField(editing.id, input);
      } else {
        await createField(input);
      }
      close();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this field and its harvests?")) return;
    startTransition(async () => {
      await deleteField(id);
    });
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Fields</Title>
        <Button onClick={openCreate}>Add field</Button>
      </Group>

      <Title order={4} mb="sm">
        Individual fields
      </Title>
      <Table striped highlightOnHover withTableBorder mb="xl">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Field #</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Purchase cost</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {individualFields.length > 0 ? (
            individualFields.map((field) => (
              <Table.Tr key={field.id}>
                <Table.Td>{field.number}</Table.Td>
                <Table.Td>{field.sizeHa.toLocaleString()} ha</Table.Td>
                <Table.Td>€{field.purchaseCost.toLocaleString()}</Table.Td>
                <Table.Td>
                  <FieldActions
                    field={field}
                    pending={pending}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <EmptyRow
              colSpan={4}
              message="No individual fields yet. Add your first field."
            />
          )}
        </Table.Tbody>
      </Table>

      <Title order={4} mb="sm">
        Merged fields
      </Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Field #</Table.Th>
            <Table.Th>Merged from</Table.Th>
            <Table.Th>Combined size</Table.Th>
            <Table.Th>Purchase cost</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {mergedFields.length > 0 ? (
            mergedFields.map((field) => (
              <Table.Tr key={field.id}>
                <Table.Td>{field.number}</Table.Td>
                <Table.Td>{formatComponents(field.components)}</Table.Td>
                <Table.Td>{field.sizeHa.toLocaleString()} ha</Table.Td>
                <Table.Td>€{field.purchaseCost.toLocaleString()}</Table.Td>
                <Table.Td>
                  <FieldActions
                    field={field}
                    pending={pending}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <EmptyRow
              colSpan={5}
              message="No merged fields yet. Toggle “Merged field” when adding a field."
            />
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={opened}
        onClose={close}
        title={editing ? "Edit field" : "Add field"}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <NumberInput
              label="Field number"
              min={1}
              required
              {...form.getInputProps("number")}
            />
            <NumberInput
              label={form.values.isMerged ? "Combined size (ha)" : "Size (ha)"}
              min={0.01}
              decimalScale={2}
              required
              {...form.getInputProps("sizeHa")}
            />
            <NumberInput
              label="Purchase cost (€)"
              min={0}
              decimalScale={2}
              required
              {...form.getInputProps("purchaseCost")}
            />
            <Switch
              label="Merged field"
              description={
                sourceOptions.length < 2
                  ? "Add at least two other fields first"
                  : undefined
              }
              disabled={sourceOptions.length < 2 && !form.values.isMerged}
              {...form.getInputProps("isMerged", { type: "checkbox" })}
            />
            {form.values.isMerged && (
              <MultiSelect
                label="Source fields"
                description="Original fields that make up this merge"
                placeholder="Select fields"
                data={sourceOptions}
                searchable
                {...form.getInputProps("sourceFieldIds")}
              />
            )}
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
