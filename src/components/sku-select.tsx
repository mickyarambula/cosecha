import { Field, Select } from "@/components/ui/input";
import { skuLabel } from "@/lib/utils";

export type SkuOption = {
  id: number;
  product_id: number;
  sku_code: string;
  product_name: string;
  variety: string | null;
  empaque: string | null;
  calibre: string | null;
  unit: string;
  name: string;
};

export function packsToSkus(
  products: {
    id: number;
    sku: string;
    name: string;
    variety: string | null;
    default_unit: string;
    packs: {
      id: number;
      sku_code?: string | null;
      empaque?: string | null;
      calibre?: string | null;
      name: string;
      unit_of_measure: string;
    }[];
  }[],
): SkuOption[] {
  return products.flatMap((p) => {
    const packs = p.packs.length ? p.packs : [{ id: 0, sku_code: p.sku, empaque: null, calibre: null, name: p.name, unit_of_measure: p.default_unit }];
    return packs
      .filter((pk) => pk.id)
      .map((pk) => ({
        id: pk.id,
        product_id: p.id,
        sku_code: pk.sku_code || p.sku,
        product_name: p.name,
        variety: p.variety,
        empaque: pk.empaque ?? null,
        calibre: pk.calibre ?? null,
        unit: pk.unit_of_measure || p.default_unit,
        name: pk.name,
      }));
  });
}

export function SkuSelect({
  value,
  skus,
  onPick,
  required,
  label = "SKU",
}: {
  value: string;
  skus: SkuOption[];
  onPick: (sku: SkuOption | null) => void;
  required?: boolean;
  label?: string;
}) {
  return (
    <Field label={label}>
      <Select
        required={required}
        value={value}
        onChange={(e) => {
          const sku = skus.find((s) => String(s.id) === e.target.value) ?? null;
          onPick(sku);
        }}
      >
        <option value="">Seleccionar SKU</option>
        {skus.map((s) => (
          <option key={s.id} value={s.id}>
            {skuLabel(s)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
