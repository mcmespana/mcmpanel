import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Star, User, MapPin, Smartphone, UserX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getAnswer,
  isAnswered,
  responseTime,
  formatDateTime,
  type AnswerValue,
  type SurveyQuestion,
  type SurveyResponse,
} from '@/lib/surveys';

export function ResponsesIndividual({
  responses,
  questions,
}: {
  responses: SurveyResponse[];
  questions: SurveyQuestion[];
}) {
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState(0);

  const sorted = useMemo(
    () => [...responses].sort((a, b) => responseTime(b) - responseTime(a)),
    [responses],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        (r.userName ?? '').toLowerCase().includes(q) ||
        (r.userDelegation ?? '').toLowerCase().includes(q) ||
        (r.userProfileType ?? '').toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const safeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const current = filtered[safeIndex];

  if (responses.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 text-center text-muted-foreground">
          Todavía no hay respuestas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o delegación…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIndex(0);
            }}
            className="bg-input border-border/50 pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[80px] text-center text-sm text-muted-foreground">
            {filtered.length ? safeIndex + 1 : 0} / {filtered.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
            disabled={safeIndex >= filtered.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {current ? (
        <Card className="bg-card/50 border-border/50">
          {/* Cabecera de la persona */}
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-4">
              {current.userName ? (
                <span className="flex items-center gap-1.5 font-semibold">
                  <User className="h-4 w-4 text-primary" />
                  {current.userName}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <UserX className="h-4 w-4" />
                  Anónimo
                </span>
              )}
              {current.userProfileType && (
                <Badge variant="secondary" className="capitalize">
                  {current.userProfileType}
                </Badge>
              )}
              {current.userDelegation && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {current.userDelegation}
                </Badge>
              )}
              {current.platform && (
                <Badge variant="outline" className="flex items-center gap-1 capitalize">
                  <Smartphone className="h-3 w-3" />
                  {current.platform}
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDateTime(current.reportedAt ?? current.timestamp)}
              </span>
            </div>

            {/* Respuestas */}
            <div className="space-y-5">
              {questions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <p className="text-sm font-medium text-muted-foreground">{q.label}</p>
                  <AnswerView question={q} value={getAnswer(current, q.id)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            Sin resultados para «{search}».
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnswerView({ question, value }: { question: SurveyQuestion; value: AnswerValue | undefined }) {
  if (!isAnswered(question, value)) {
    return <p className="text-sm italic text-muted-foreground/60">Sin respuesta</p>;
  }

  switch (question.type) {
    case 'stars': {
      const v = value as number;
      return (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className="h-5 w-5 text-warning"
              fill={s <= Math.round(v) ? 'currentColor' : 'transparent'}
            />
          ))}
          <span className="ml-2 text-sm font-medium">{v}/5</span>
        </div>
      );
    }
    case 'scale': {
      const v = value as number;
      const min = question.min ?? 0;
      const max = question.max ?? 10;
      const pct = ((v - min) / (max - min)) * 100;
      return (
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">{v}</span>
            <span className="text-xs text-muted-foreground">/ {max}</span>
          </div>
          <div className="h-2 w-full max-w-xs rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
        </div>
      );
    }
    case 'yesno':
      return (
        <Badge className={cn(value ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
          {value ? 'Sí' : 'No'}
        </Badge>
      );
    case 'single': {
      const label = question.options?.find((o) => o.value === value)?.label ?? String(value);
      return <Badge variant="secondary">{label}</Badge>;
    }
    case 'multi': {
      const arr = value as string[];
      return (
        <div className="flex flex-wrap gap-1.5">
          {arr.map((v) => {
            const label = question.options?.find((o) => o.value === v)?.label ?? v;
            return (
              <Badge key={v} variant="secondary">
                {label}
              </Badge>
            );
          })}
        </div>
      );
    }
    case 'text':
    default:
      return (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/90">
          {String(value)}
        </blockquote>
      );
  }
}
