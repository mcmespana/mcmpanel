import { useState } from 'react';
import { Send, Calendar, Users, Smartphone, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type ScheduleType = 'immediate' | 'scheduled';
type TargetAudience = 'all' | 'mcm-europa' | 'mcm-castellon' | 'mcm-madrid' | 'custom';

interface NotificationData {
  title: string;
  message: string;
  channel: TargetAudience;
  scheduleType: ScheduleType;
  scheduledDate?: string;
  scheduledTime?: string;
  actionUrl?: string;
  icon?: string;
}

export function NotificationsSection() {
  const { toast } = useToast();
  const [notification, setNotification] = useState<NotificationData>({
    title: '',
    message: '',
    channel: 'all',
    scheduleType: 'immediate',
    actionUrl: '',
    icon: 'default'
  });

  const channels = [
    { value: 'all', label: 'Todos los usuarios', count: '1,247', color: 'bg-primary' },
    { value: 'mcm-europa', label: 'MCM Europa', count: '523', color: 'bg-blue-500' },
    { value: 'mcm-castellon', label: 'MCM Castellón', count: '381', color: 'bg-green-500' },
    { value: 'mcm-madrid', label: 'MCM Madrid', count: '343', color: 'bg-red-500' },
    { value: 'custom', label: 'Audiencia personalizada', count: '0', color: 'bg-muted' }
  ];

  const icons = [
    { value: 'default', label: 'Por defecto', emoji: '📱' },
    { value: 'event', label: 'Evento', emoji: '📅' },
    { value: 'music', label: 'Música', emoji: '🎵' },
    { value: 'prayer', label: 'Oración', emoji: '🙏' },
    { value: 'news', label: 'Noticias', emoji: '📰' },
    { value: 'alert', label: 'Alerta', emoji: '⚠️' }
  ];

  const handleSend = () => {
    if (!notification.title || !notification.message) {
      toast({
        title: "Campos requeridos",
        description: "Por favor, completa el título y el mensaje",
        variant: "destructive"
      });
      return;
    }

    // Simulate sending
    toast({
      title: "Notificación enviada",
      description: `Se ha ${notification.scheduleType === 'immediate' ? 'enviado' : 'programado'} la notificación correctamente`,
    });
  };

  const selectedChannel = channels.find(c => c.value === notification.channel);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Notificaciones Push
          </h1>
          <p className="text-muted-foreground">
            Envía notificaciones a usuarios de la aplicación móvil
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Smartphone className="w-4 h-4" />
          <span>Sistema de notificaciones MCM</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-primary" />
                <span>Crear Notificación</span>
              </CardTitle>
              <CardDescription>
                Configura el contenido y destinatarios de tu notificación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Channel Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Canal de destino</Label>
                <Select 
                  value={notification.channel} 
                  onValueChange={(value: TargetAudience) => 
                    setNotification(prev => ({ ...prev, channel: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.value} value={channel.value}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${channel.color}`} />
                          <span>{channel.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {channel.count}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Título de la notificación"
                    value={notification.title}
                    onChange={(e) => setNotification(prev => ({ ...prev, title: e.target.value }))}
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    {notification.title.length}/50 caracteres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon">Icono</Label>
                  <Select 
                    value={notification.icon} 
                    onValueChange={(value) => 
                      setNotification(prev => ({ ...prev, icon: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un icono" />
                    </SelectTrigger>
                    <SelectContent>
                      {icons.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          <div className="flex items-center space-x-2">
                            <span>{icon.emoji}</span>
                            <span>{icon.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensaje *</Label>
                <Textarea
                  id="message"
                  placeholder="Contenido del mensaje..."
                  value={notification.message}
                  onChange={(e) => setNotification(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={200}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {notification.message.length}/200 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actionUrl">URL de acción (opcional)</Label>
                <Input
                  id="actionUrl"
                  placeholder="https://app.mcm.com/section"
                  value={notification.actionUrl}
                  onChange={(e) => setNotification(prev => ({ ...prev, actionUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  URL a la que redirigir al tocar la notificación
                </p>
              </div>

              <Separator />

              {/* Scheduling */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Programación</Label>
                <RadioGroup
                  value={notification.scheduleType}
                  onValueChange={(value: ScheduleType) => 
                    setNotification(prev => ({ ...prev, scheduleType: value }))
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="immediate" id="immediate" />
                    <Label htmlFor="immediate" className="cursor-pointer">
                      Enviar ahora
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="scheduled" id="scheduled" />
                    <Label htmlFor="scheduled" className="cursor-pointer">
                      Programar envío
                    </Label>
                  </div>
                </RadioGroup>

                {notification.scheduleType === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Fecha</Label>
                      <Input
                        id="date"
                        type="date"
                        value={notification.scheduledDate}
                        onChange={(e) => setNotification(prev => ({ ...prev, scheduledDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Hora</Label>
                      <Input
                        id="time"
                        type="time"
                        value={notification.scheduledTime}
                        onChange={(e) => setNotification(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview & Stats */}
        <div className="space-y-6">
          {/* Preview */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-accent" />
                <span>Vista previa</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 space-y-2">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {icons.find(i => i.value === notification.icon)?.emoji || '📱'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {notification.title || 'Título de la notificación'}
                      </p>
                      <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                        {notification.message || 'Mensaje de la notificación aparecerá aquí...'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 text-xs">ahora</span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Canal:</strong> {selectedChannel?.label}</p>
                <p><strong>Destinatarios:</strong> {selectedChannel?.count}</p>
                {notification.scheduleType === 'scheduled' && (
                  <p><strong>Programada:</strong> {notification.scheduledDate} {notification.scheduledTime}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Channel Stats */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-accent" />
                <span>Estadísticas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {channels.map((channel) => (
                <div key={channel.value} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${channel.color}`} />
                    <span className="text-sm">{channel.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {channel.count}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleSend} 
              size="lg" 
              className="w-full tech-glow"
              disabled={!notification.title || !notification.message}
            >
              <Send className="w-4 h-4 mr-2" />
              {notification.scheduleType === 'immediate' ? 'Enviar Notificación' : 'Programar Notificación'}
            </Button>
            
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Configuración avanzada
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}