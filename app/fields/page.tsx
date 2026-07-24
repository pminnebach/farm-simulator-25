import { FieldsManager } from "@/components/FieldsManager";
import { listFields } from "@/lib/actions/fields";

export const dynamic = "force-dynamic";

export default async function FieldsPage() {
  const fields = await listFields();
  return <FieldsManager fields={fields} />;
}
