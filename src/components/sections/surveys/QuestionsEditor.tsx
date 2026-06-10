import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Plus, X, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  QUESTION_TYPE_META,
  makeQuestionId,
  type QuestionType,
  type SurveyQuestion,
} from '@/lib/surveys';
import { slugify } from '@/lib/profileCatalog';

interface QuestionsEditorProps {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
  /** ids que ya tienen respuestas → no editables (rompería la correspondencia). */
  lockedIds: Set<string>;
}

const TYPES_NEEDING_OPTIONS: QuestionType[] = ['single', 'multi'];

export function QuestionsEditor({ questions, onChange, lockedIds }: QuestionsEditorProps) {
  const update = (index: number, patch: Partial<SurveyQuestion>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const remove = (index: number) => onChange(questions.filter((_, i) => i !== index));

  const add = () => {
    const id = makeQuestionId('pregunta', questions.map((q) => q.id));
    onChange([...questions, { id, type: 'stars', label: '', optional: false }]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = [...questions];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onChange(next);
  };

  const changeType = (index: number, type: QuestionType) => {
    const q = questions[index];
    const patch: Partial<SurveyQuestion> = { type };
    // Inicializa campos propios del nuevo tipo, limpia los que no aplican.
    if (TYPES_NEEDING_OPTIONS.includes(type)) {
      patch.options = q.options && q.options.length >= 2
        ? q.options
        : [
            { value: 'opcion-1', label: 'Opción 1' },
            { value: 'opcion-2', label: 'Opción 2' },
          ];
    } else {
      patch.options = undefined;
    }
    if (type === 'scale') {
      patch.min = q.min ?? 0;
      patch.max = q.max ?? 10;
    } else {
      patch.min = undefined;
      patch.max = undefined;
      patch.minLabel = undefined;
      patch.maxLabel = undefined;
    }
    if (type !== 'text') patch.placeholder = undefined;
    update(index, patch);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="questions">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {questions.map((q, index) => {
                const locked = lockedIds.has(q.id);
                return (
                  <Draggable key={`${q.id}-${index}`} draggableId={`${q.id}-${index}`} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={cn(
                          'rounded-lg border border-border/50 bg-card/50 p-4 space-y-3',
                          snapshot.isDragging && 'shadow-lg ring-1 ring-primary/40',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            {...dragProvided.dragHandleProps}
                            className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
                            title="Arrastrar para reordenar"
                          >
                            <GripVertical className="h-5 w-5" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                #{index + 1}
                              </Badge>
                              <Select
                                value={q.type}
                                onValueChange={(v) => changeType(index, v as QuestionType)}
                              >
                                <SelectTrigger className="h-8 w-[160px] bg-input border-border/50 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(QUESTION_TYPE_META) as QuestionType[]).map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {QUESTION_TYPE_META[t].label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  id={`opt-${index}`}
                                  checked={!q.optional}
                                  onCheckedChange={(v) => update(index, { optional: !v })}
                                />
                                <Label htmlFor={`opt-${index}`} className="text-xs text-muted-foreground">
                                  Obligatoria
                                </Label>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-auto h-8 px-2 text-destructive hover:text-destructive"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Enunciado */}
                            <Input
                              placeholder="Enunciado de la pregunta"
                              value={q.label}
                              onChange={(e) => update(index, { label: e.target.value })}
                              className="bg-input border-border/50"
                            />

                            {/* Identificador */}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                id
                              </Label>
                              <Input
                                value={q.id}
                                disabled={locked}
                                onChange={(e) =>
                                  update(index, { id: slugify(e.target.value) })
                                }
                                className="h-8 bg-input border-border/50 font-mono text-xs"
                              />
                              {locked ? (
                                <span
                                  className="flex items-center gap-1 text-[10px] text-warning"
                                  title="Esta pregunta ya tiene respuestas: cambiar el id rompería la correspondencia."
                                >
                                  <Lock className="h-3 w-3" /> con respuestas
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-muted-foreground"
                                  title="Generar id desde el enunciado"
                                  onClick={() =>
                                    update(index, {
                                      id: makeQuestionId(
                                        q.label || 'pregunta',
                                        questions.filter((_, i) => i !== index).map((x) => x.id),
                                      ),
                                    })
                                  }
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>

                            <TypeFields question={q} onChange={(patch) => update(index, patch)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button type="button" variant="outline" className="w-full" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />
        Añadir pregunta
      </Button>
    </div>
  );
}

function TypeFields({
  question,
  onChange,
}: {
  question: SurveyQuestion;
  onChange: (patch: Partial<SurveyQuestion>) => void;
}) {
  if (question.type === 'text') {
    return (
      <Input
        placeholder="Texto guía (placeholder) — opcional"
        value={question.placeholder ?? ''}
        onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
        className="bg-input border-border/50 text-sm"
      />
    );
  }

  if (question.type === 'scale') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mínimo</Label>
          <Input
            type="number"
            value={question.min ?? 0}
            onChange={(e) => onChange({ min: Number(e.target.value) })}
            className="h-8 bg-input border-border/50"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Máximo</Label>
          <Input
            type="number"
            value={question.max ?? 10}
            onChange={(e) => onChange({ max: Number(e.target.value) })}
            className="h-8 bg-input border-border/50"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Etiqueta mínimo</Label>
          <Input
            placeholder="Ej: Nada probable"
            value={question.minLabel ?? ''}
            onChange={(e) => onChange({ minLabel: e.target.value || undefined })}
            className="h-8 bg-input border-border/50 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Etiqueta máximo</Label>
          <Input
            placeholder="Ej: Muy probable"
            value={question.maxLabel ?? ''}
            onChange={(e) => onChange({ maxLabel: e.target.value || undefined })}
            className="h-8 bg-input border-border/50 text-sm"
          />
        </div>
      </div>
    );
  }

  if (question.type === 'single' || question.type === 'multi') {
    return <OptionsEditor question={question} onChange={onChange} />;
  }

  return null;
}

function OptionsEditor({
  question,
  onChange,
}: {
  question: SurveyQuestion;
  onChange: (patch: Partial<SurveyQuestion>) => void;
}) {
  const options = question.options ?? [];

  const updateOption = (i: number, patch: Partial<{ value: string; label: string }>) => {
    onChange({ options: options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  };

  const removeOption = (i: number) => onChange({ options: options.filter((_, idx) => idx !== i) });

  const addOption = () => {
    const existing = options.map((o) => o.value);
    let value = `opcion-${options.length + 1}`;
    let n = options.length + 1;
    while (existing.includes(value)) value = `opcion-${++n}`;
    onChange({ options: [...options, { value, label: '' }] });
  };

  return (
    <div className="space-y-2 rounded-md border border-border/40 bg-background/40 p-3">
      <Label className="text-xs font-medium text-muted-foreground">Opciones</Label>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="Texto visible"
            value={o.label}
            onChange={(e) => {
              const label = e.target.value;
              // Si el value sigue siendo el autogenerado, sincronízalo con el label.
              const auto = !o.value || /^opcion-\d+$/.test(o.value);
              updateOption(i, auto ? { label, value: slugify(label) || o.value } : { label });
            }}
            className="h-8 bg-input border-border/50 text-sm"
          />
          <Input
            placeholder="value"
            value={o.value}
            onChange={(e) => updateOption(i, { value: slugify(e.target.value) })}
            className="h-8 w-32 bg-input border-border/50 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive"
            onClick={() => removeOption(i)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addOption}>
        <Plus className="mr-2 h-3.5 w-3.5" />
        Añadir opción
      </Button>
    </div>
  );
}
