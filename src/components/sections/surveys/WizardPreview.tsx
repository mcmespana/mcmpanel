import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SurveyConfig, SurveyQuestion } from '@/lib/surveys';

/**
 * Réplica ligera del wizard de la MCM App: una pregunta por pantalla con barra
 * de progreso, para que el editor vea cómo se mostrará en el móvil. Es solo
 * presentación — los valores introducidos no se guardan en ningún sitio.
 */
export function WizardPreview({ config }: { config: SurveyConfig }) {
  const questions = useMemo(() => config.questions ?? [], [config.questions]);
  const accent = config.accentColor || '#31AADF';
  // -1 = pantalla de bienvenida, questions.length = agradecimiento.
  const [step, setStep] = useState(-1);
  const [values, setValues] = useState<Record<string, unknown>>({});

  // Si cambian las preguntas (se añaden/quitan), no salirse de rango.
  useEffect(() => {
    setStep((s) => Math.min(s, questions.length));
  }, [questions.length]);

  const total = questions.length;
  const current = step >= 0 && step < total ? questions[step] : null;
  const progress = total > 0 ? Math.min(Math.max(step, 0), total) / total : 0;

  const setValue = (id: string, v: unknown) => setValues((prev) => ({ ...prev, [id]: v }));

  return (
    <div className="mx-auto w-full max-w-[320px]">
      {/* Marco del teléfono */}
      <div className="rounded-[2rem] border-4 border-gray-800 bg-gray-950 p-3 shadow-2xl">
        <div className="rounded-[1.4rem] bg-background overflow-hidden" style={{ minHeight: 460 }}>
          {/* Barra de progreso */}
          <div className="h-1.5 w-full bg-muted">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${progress * 100}%`, backgroundColor: accent }}
            />
          </div>

          <div className="flex flex-col p-5" style={{ minHeight: 452 }}>
            {step === -1 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center gap-3">
                <div className="text-5xl">{config.emoji || '📋'}</div>
                <h3 className="text-lg font-bold">{config.title || 'Título de la encuesta'}</h3>
                <p className="text-sm text-muted-foreground">
                  {config.intro || 'Texto de introducción de la encuesta.'}
                </p>
              </div>
            )}

            {current && (
              <div className="flex flex-1 flex-col">
                <div className="text-xs font-medium text-muted-foreground">
                  Pregunta {step + 1} de {total}
                  {current.optional ? ' · opcional' : ''}
                </div>
                <h3 className="mt-2 text-base font-semibold leading-snug">
                  {current.label || 'Enunciado de la pregunta'}
                </h3>

                <div className="mt-5 flex-1">
                  <QuestionInput
                    question={current}
                    accent={accent}
                    value={values[current.id]}
                    onChange={(v) => setValue(current.id, v)}
                  />
                </div>
              </div>
            )}

            {step === total && total > 0 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center gap-3">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}22`, color: accent }}
                >
                  <Check className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold">{config.thanksTitle || '¡Gracias!'}</h3>
                <p className="text-sm text-muted-foreground">
                  {config.thanksBody || 'Tu opinión nos ayuda.'}
                </p>
              </div>
            )}

            {/* Navegación */}
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(-1, s - 1))}
                disabled={step <= -1}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" /> Atrás
              </button>
              {step < total ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(total, s + 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {step === total - 1 ? 'Enviar' : 'Siguiente'} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setStep(-1);
                    setValues({});
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: accent }}
                >
                  Reiniciar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Vista previa — así se verá en el móvil
      </p>
    </div>
  );
}

function QuestionInput({
  question,
  accent,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  accent: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (question.type) {
    case 'stars': {
      const v = typeof value === 'number' ? value : 0;
      return (
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => onChange(star)}>
              <Star
                className="h-8 w-8 transition-transform hover:scale-110"
                style={{ color: accent }}
                fill={star <= v ? accent : 'transparent'}
              />
            </button>
          ))}
        </div>
      );
    }
    case 'scale': {
      const min = question.min ?? 0;
      const max = question.max ?? 10;
      const v = typeof value === 'number' ? value : null;
      const buttons = [];
      for (let i = min; i <= max; i++) buttons.push(i);
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-center gap-1.5">
            {buttons.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange(i)}
                className={cn(
                  'h-9 w-9 rounded-lg border text-sm font-medium transition-colors',
                  v === i ? 'text-white border-transparent' : 'border-border text-foreground',
                )}
                style={v === i ? { backgroundColor: accent } : undefined}
              >
                {i}
              </button>
            ))}
          </div>
          {(question.minLabel || question.maxLabel) && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{question.minLabel}</span>
              <span>{question.maxLabel}</span>
            </div>
          )}
        </div>
      );
    }
    case 'text':
      return (
        <textarea
          placeholder={question.placeholder || 'Escribe tu respuesta…'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] w-full rounded-lg border border-border bg-input p-3 text-sm"
        />
      );
    case 'yesno':
      return (
        <div className="flex justify-center gap-3">
          {[
            { v: true, label: 'Sí' },
            { v: false, label: 'No' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.v)}
              className={cn(
                'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                value === opt.v ? 'text-white border-transparent' : 'border-border',
              )}
              style={value === opt.v ? { backgroundColor: accent } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    case 'single':
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                value === o.value ? 'border-transparent' : 'border-border',
              )}
              style={value === o.value ? { backgroundColor: `${accent}1a`, borderColor: accent } : undefined}
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full border"
                style={{ borderColor: accent }}
              >
                {value === o.value && (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                )}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      );
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (val: string) =>
        onChange(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
      return (
        <div className="space-y-2">
          {(question.options ?? []).map((o) => {
            const checked = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                  checked ? 'border-transparent' : 'border-border',
                )}
                style={checked ? { backgroundColor: `${accent}1a`, borderColor: accent } : undefined}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded border"
                  style={{ borderColor: accent, backgroundColor: checked ? accent : 'transparent' }}
                >
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}
