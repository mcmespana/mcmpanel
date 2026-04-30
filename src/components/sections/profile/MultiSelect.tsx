import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  id: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  description?: string;
  emptyHint?: string;
  className?: string;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  description,
  emptyHint,
  className,
}: MultiSelectProps) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  // Detect IDs in `value` that are not in catalog (legacy / typo)
  const unknownInValue = value.filter((v) => !options.some((o) => o.id === v));

  return (
    <div className={cn('space-y-2', className)}>
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
        )}
      </div>

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {emptyHint ?? 'Sin opciones disponibles'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {options.map((opt) => {
            const checked = value.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors',
                  checked
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : 'bg-card/30 border-border/40 text-muted-foreground hover:bg-muted/40'
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(opt.id)}
                  className="h-3.5 w-3.5"
                />
                <span className="truncate leading-tight">{opt.label}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">
                  {opt.id}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {unknownInValue.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/5 px-2.5 py-1.5">
          <p className="text-xs text-warning-foreground/80">
            IDs desconocidos guardados:{' '}
            <span className="font-mono">{unknownInValue.join(', ')}</span>{' '}
            <button
              type="button"
              className="underline hover:text-warning-foreground"
              onClick={() => onChange(value.filter((v) => !unknownInValue.includes(v)))}
            >
              limpiar
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
