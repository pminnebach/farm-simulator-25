import { HarvestsManager } from "@/components/HarvestsManager";
import { listFields } from "@/lib/actions/fields";
import { listHarvests } from "@/lib/actions/harvests";

export const dynamic = "force-dynamic";

export default async function HarvestsPage() {
  const [harvests, fields] = await Promise.all([listHarvests(), listFields()]);
  return <HarvestsManager harvests={harvests} fields={fields} />;
}
