import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';

const METRICS = [
  'TPS',
  'MSPT',
  'Players',
  'Heap',
  'Host CPU',
  'Disk use',
  'Net RX',
  'Net TX',
  'Package °C',
  'Ambient °C',
] as const;

/** Live Combobox demo for Kit — searchable metric picker. */
export function KitComboboxDemo() {
  return (
    <div className="max-w-sm space-y-2">
      <Label htmlFor="kit-combobox-input">Jump to metric</Label>
      <Combobox items={[...METRICS]}>
        <ComboboxInput id="kit-combobox-input" placeholder="Search metrics…" showClear />
        <ComboboxContent>
          <ComboboxEmpty>No metric found.</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="m-0 text-[0.7rem] text-muted-foreground">
        Type to filter — use when the list is long enough that Select is awkward.
      </p>
    </div>
  );
}
