import { useMemo, useState } from 'react';
import { Rocket, Check, AlertTriangle, Loader2, Send, Megaphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sendNotification } from '@/lib/notificationService';
import {
  buildIndex,
  writeIndex,
  writeSurveyConfig,
  validateQuestions,
  DELEGATION_OPTIONS,
  PROFILE_TYPE_OPTIONS,
  PROFILE_TYPE_TO_TOPIC,
  type SurveyEntry,
} from '@/lib/surveys';

const ALL = '__all';

interface LaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: SurveyEntry;
  /** Todas las encuestas genéricas (para recomputar el índice de banners). */
  allGenerics: SurveyEntry[];
  onLaunched?: () => void;
}

export function LaunchDialog({ open, onOpenChange, entry, allGenerics, onLaunched }: LaunchDialogProps) {
  const { toast } = useToast();
  const config = entry.config;
  const [busy, setBusy] = useState(false);
  const [sendPush, setSendPush] = useState(true);
  const [pushTitle, setPushTitle] = useState(config.title || 'Nueva encuesta');
  const [pushBody, setPushBody] = useState(config.intro || '¡Ayúdanos respondiendo esta encuesta!');

  // Prefill del segmento a partir de audience (mapea profileType→topic plural).
  const defaultProfileTopic = useMemo(() => {
    const first = config.audience?.profileTypes?.[0];
    return first ? PROFILE_TYPE_TO_TOPIC[first] : ALL;
  }, [config.audience]);
  const defaultDelegation = useMemo(
    () => config.audience?.delegationIds?.[0] ?? ALL,
    [config.audience],
  );
  const [profileTopic, setProfileTopic] = useState(defaultProfileTopic);
  const [delegationTopic, setDelegationTopic] = useState(defaultDelegation);

  const route = `/encuesta/${entry.id}`;
  const questionErrors = validateQuestions(config.questions ?? []);
  const hasBanner = (config.placement?.type ?? 'link-only') !== 'link-only';

  const checklist = [
    {
      ok: questionErrors.length === 0,
      label: questionErrors.length === 0
        ? `${config.questions?.length ?? 0} preguntas válidas`
        : 'Hay preguntas con errores',
    },
    {
      ok: true,
      label: config.audience && Object.values(config.audience).some((a) => a && a.length)
        ? 'Audiencia segmentada'
        : 'Audiencia: todos los usuarios',
    },
    {
      ok: config.closesAt != null,
      label: config.closesAt != null ? 'Fecha de cierre definida' : 'Sin fecha de cierre (cierre manual)',
      warn: config.closesAt == null,
    },
    {
      ok: true,
      label: hasBanner
        ? 'Aparecerá como banner en la app (índice actualizado)'
        : 'Solo accesible por enlace / push',
    },
  ];

  const resolveTopics = (): string[] => {
    const topics: string[] = [];
    if (profileTopic !== ALL) topics.push(profileTopic);
    if (delegationTopic !== ALL) topics.push(delegationTopic);
    return topics;
  };

  const handleLaunch = async () => {
    if (questionErrors.length > 0) {
      toast({
        title: 'No se puede lanzar',
        description: questionErrors[0],
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      // 1. Abrir la encuesta.
      const nextConfig = { ...config, status: 'open' as const };
      await writeSurveyConfig(entry.configPath, nextConfig);

      // 2. Recomputar índice de banners con el estado nuevo.
      const generics = allGenerics.map((g) =>
        g.id === entry.id ? { id: g.id, config: nextConfig } : { id: g.id, config: g.config },
      );
      await writeIndex(buildIndex(generics));

      // 3. Push opcional que lleva a /encuesta/<id>.
      if (sendPush) {
        const topics = resolveTopics();
        await sendNotification({
          title: pushTitle.trim() || 'Nueva encuesta',
          body: pushBody.trim() || 'Toca para responder',
          category: 'general',
          priority: 'default',
          internalRoute: route,
          actionButtons: [{ text: 'Responder', url: route, isInternal: true }],
          topics: topics.length ? topics : undefined,
        });
      }

      toast({
        title: '🚀 Encuesta lanzada',
        description: sendPush
          ? 'Abierta, banner actualizado y notificación enviada.'
          : 'Abierta y banner actualizado.',
      });
      onOpenChange(false);
      onLaunched?.();
    } catch (e) {
      toast({
        title: 'Error al lanzar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Lanzar encuesta
          </DialogTitle>
          <DialogDescription>
            Se abrirá «{entry.label}» y, si lo activas, se enviará una notificación push.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Checklist */}
          <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {item.ok ? (
                  item.warn ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <Check className="h-4 w-4 text-success" />
                  )
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <span className={cn(!item.ok && 'text-destructive')}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Push */}
          <div className="space-y-3 rounded-lg border border-border/40 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="send-push" className="flex items-center gap-2 text-sm font-medium">
                <Send className="h-4 w-4" />
                Enviar notificación push
              </Label>
              <Switch id="send-push" checked={sendPush} onCheckedChange={setSendPush} />
            </div>

            {sendPush && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <Input
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    className="bg-input border-border/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cuerpo</Label>
                  <Textarea
                    value={pushBody}
                    onChange={(e) => setPushBody(e.target.value)}
                    className="bg-input border-border/50 min-h-[60px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Perfil</Label>
                    <Select value={profileTopic} onValueChange={setProfileTopic}>
                      <SelectTrigger className="h-8 bg-input border-border/50 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Todos</SelectItem>
                        {PROFILE_TYPE_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={PROFILE_TYPE_TO_TOPIC[p.value]}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Delegación</Label>
                    <Select value={delegationTopic} onValueChange={setDelegationTopic}>
                      <SelectTrigger className="h-8 bg-input border-border/50 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Todas</SelectItem>
                        {DELEGATION_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Megaphone className="h-3 w-3" />
                  {resolveTopics().length
                    ? `Solo dispositivos con: ${resolveTopics().join(' + ')} (AND)`
                    : 'Se enviará a todos los dispositivos.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Al tocar: <code className="rounded bg-muted px-1">{route}</code>
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleLaunch} disabled={busy} className="tech-glow">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            Lanzar ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
