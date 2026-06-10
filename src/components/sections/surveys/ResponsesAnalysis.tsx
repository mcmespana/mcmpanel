import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  Users,
  Smartphone,
  CalendarDays,
  MessageSquareText,
  Info,
  Filter,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  aggregateQuestion,
  dedupResponses,
  filterResponses,
  segmentOptions,
  responseTime,
  formatDate,
  localInputToMs,
  QUESTION_TYPE_META,
  type QuestionAgg,
  type SegmentFilter,
  type SurveyQuestion,
  type SurveyResponse,
} from '@/lib/surveys';

const PRIMARY = 'hsl(197 89% 61%)';
const ACCENT = 'hsl(166 67% 51%)';
const SUCCESS = 'hsl(142 76% 45%)';
const DESTRUCTIVE = 'hsl(0 84% 60%)';
const WARNING = 'hsl(38 92% 65%)';
const PALETTE = [PRIMARY, ACCENT, WARNING, 'hsl(280 65% 62%)', 'hsl(20 90% 62%)', 'hsl(330 70% 62%)', SUCCESS];

const ALL = '__all';

export function ResponsesAnalysis({
  responses,
  questions,
}: {
  responses: SurveyResponse[];
  questions: SurveyQuestion[];
}) {
  const [filter, setFilter] = useState<SegmentFilter>({});
  const options = useMemo(() => segmentOptions(responses), [responses]);

  const filtered = useMemo(() => filterResponses(responses, filter), [responses, filter]);
  const { deduped, peopleCount, deviceCount } = useMemo(() => dedupResponses(filtered), [filtered]);

  const total = deduped.length;
  const times = deduped.map(responseTime).filter((t) => t > 0);
  const firstAt = times.length ? Math.min(...times) : undefined;
  const lastAt = times.length ? Math.max(...times) : undefined;

  const platformBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of deduped) map[r.platform ?? 'desconocido'] = (map[r.platform ?? 'desconocido'] ?? 0) + 1;
    return map;
  }, [deduped]);

  const updateFilter = (patch: Partial<SegmentFilter>) => setFilter((prev) => ({ ...prev, ...patch }));
  const hasFilter = Object.values(filter).some((v) => v != null && v !== '');

  if (responses.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 text-center text-muted-foreground">
          Todavía no hay respuestas que analizar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros sticky */}
      <div className="sticky top-2 z-10 rounded-lg border border-border/50 bg-card/90 p-3 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-primary" />
          Segmentar análisis
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs text-muted-foreground"
              onClick={() => setFilter({})}
            >
              Limpiar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <SegSelect
            label="Perfil"
            value={filter.profileType ?? ALL}
            options={options.profiles}
            onChange={(v) => updateFilter({ profileType: v === ALL ? undefined : v })}
          />
          <SegSelect
            label="Delegación"
            value={filter.delegation ?? ALL}
            options={options.delegations}
            onChange={(v) => updateFilter({ delegation: v === ALL ? undefined : v })}
          />
          <SegSelect
            label="Plataforma"
            value={filter.platform ?? ALL}
            options={options.platforms}
            onChange={(v) => updateFilter({ platform: v === ALL ? undefined : v })}
          />
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Desde</Label>
            <Input
              type="date"
              onChange={(e) => updateFilter({ from: localInputToMs(e.target.value ? `${e.target.value}T00:00` : '') })}
              className="h-8 bg-input border-border/50 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              onChange={(e) => updateFilter({ to: localInputToMs(e.target.value ? `${e.target.value}T23:59` : '') })}
              className="h-8 bg-input border-border/50 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Métricas de cabecera */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={<Users className="h-7 w-7 text-primary/50" />}
          label="Respuestas"
          value={total}
          extra={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  {peopleCount} personas · {deviceCount} disp.
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs">
                  «Personas» son respuestas con sesión iniciada (dedup por usuario). «Disp.» son
                  respuestas sin login, contadas por dispositivo.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        />
        <MetricCard
          icon={<CalendarDays className="h-7 w-7 text-accent/50" />}
          label="Primera respuesta"
          value={firstAt ? formatDate(firstAt) : '—'}
          small
        />
        <MetricCard
          icon={<CalendarDays className="h-7 w-7 text-accent/50" />}
          label="Última respuesta"
          value={lastAt ? formatDate(lastAt) : '—'}
          small
        />
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" /> Plataforma
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(platformBreakdown).map(([p, n]) => (
                <Badge key={p} variant="outline" className="text-[10px] capitalize">
                  {p}: {n}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarjeta por pregunta */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {questions.map((q) => {
          const agg = aggregateQuestion(q, deduped);
          const completion = total > 0 ? Math.round((agg.n / total) * 100) : 0;
          return (
            <Card key={q.id} className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-snug">{q.label}</CardTitle>
                  <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                    {QUESTION_TYPE_META[q.type].label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {agg.n} respuestas · {completion}% de completado
                </p>
              </CardHeader>
              <CardContent>
                <QuestionChart question={q} agg={agg} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SegSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 bg-input border-border/50 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  extra,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  extra?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={small ? 'text-base font-semibold' : 'text-2xl font-bold text-primary'}>{value}</p>
            {extra}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionChart({ question, agg }: { question: SurveyQuestion; agg: QuestionAgg }) {
  if (agg.n === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground/60">Sin respuestas a esta pregunta.</p>;
  }

  if (agg.kind === 'numeric') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Media</p>
            <p className="text-2xl font-bold text-primary">{agg.mean.toFixed(1)}</p>
          </div>
          {agg.nps !== undefined && (
            <div className="ml-auto rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-center">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> NPS
              </p>
              <p className="text-2xl font-bold text-primary">{agg.nps}</p>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={agg.distribution} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(215 12% 55%)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(215 12% 55%)' }} />
            <Tooltip
              contentStyle={{ background: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 18%)', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: 'hsl(220 13% 18% / 0.4)' }}
            />
            <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (agg.kind === 'boolean') {
    const data = [
      { name: 'Sí', value: agg.yes },
      { name: 'No', value: agg.no },
    ];
    const pctYes = agg.n ? Math.round((agg.yes / agg.n) * 100) : 0;
    return (
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={150}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={2}>
              <Cell fill={SUCCESS} />
              <Cell fill={DESTRUCTIVE} />
            </Pie>
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          <div>
            <p className="text-3xl font-bold text-success">{pctYes}%</p>
            <p className="text-xs text-muted-foreground">respondió Sí</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Sí: {agg.yes} · No: {agg.no}
          </div>
        </div>
      </div>
    );
  }

  if (agg.kind === 'options') {
    const data = agg.items.map((it) => ({ name: it.label, count: it.count, pct: Math.round(it.pct) }));
    return (
      <div className="space-y-2">
        {question.type === 'multi' && (
          <p className="text-xs text-muted-foreground">
            {agg.total} selecciones (cada persona puede elegir varias)
          </p>
        )}
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 38)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: 'hsl(210 20% 80%)' }}
            />
            <Tooltip
              contentStyle={{ background: 'hsl(220 13% 10%)', border: '1px solid hsl(220 13% 18%)', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: 'hsl(220 13% 18% / 0.4)' }}
              formatter={(value: number, _name, props) => [`${value} (${props.payload.pct}%)`, 'Respuestas']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // text
  return <TextResponses agg={agg} />;
}

function TextResponses({ agg }: { agg: Extract<QuestionAgg, { kind: 'text' }> }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;
  const pages = Math.ceil(agg.values.length / PAGE_SIZE);
  const slice = agg.values.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const avgLen = agg.n
    ? Math.round(agg.values.reduce((sum, v) => sum + v.text.length, 0) / agg.n)
    : 0;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquareText className="h-3.5 w-3.5" />
        {agg.n} respuestas · longitud media {avgLen} caracteres
      </p>
      <div className="space-y-2">
        {slice.map((v, i) => (
          <blockquote
            key={i}
            className="rounded-md border-l-2 border-primary/40 bg-muted/20 py-2 pl-3 pr-2 text-sm italic"
          >
            "{v.text}"
            {v.response.userName && (
              <span className="mt-1 block text-[10px] not-italic text-muted-foreground">
                — {v.response.userName}
                {v.response.userDelegation ? ` · ${v.response.userDelegation}` : ''}
              </span>
            )}
          </blockquote>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
