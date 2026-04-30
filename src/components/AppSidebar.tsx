import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Database,
  Images,
  Calendar,
  Music,
  Gamepad2,
  Trophy,
  Zap,
  Bell,
  Users,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveSection, JSONData } from "./JSONManager";

interface AppSidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  jsonData: JSONData;
  firebaseConnected: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
}

const menuItems = [
  {
    id: 'app' as ActiveSection,
    title: 'App',
    icon: Database,
    description: 'Feedback y config',
  },
  {
    id: 'albums' as ActiveSection,
    title: 'Albums',
    icon: Images,
    description: 'Gestión de álbumes',
  },
  {
    id: 'calendars' as ActiveSection,
    title: 'Calendars',
    icon: Calendar,
    description: 'Calendarios',
  },
  {
    id: 'songs' as ActiveSection,
    title: 'Cantoral',
    icon: Music,
    description: 'Canciones y repertorio',
  },
  {
    id: 'wordle' as ActiveSection,
    title: 'Wordle',
    icon: Gamepad2,
    description: 'Palabras diarias',
  },
  {
    id: 'activities' as ActiveSection,
    title: 'Actividades',
    icon: Zap,
    description: 'Gestión de actividades',
  },
  {
    id: 'notifications' as ActiveSection,
    title: 'Notificaciones',
    icon: Bell,
    description: 'Push notifications',
  },
  {
    id: 'profileConfig' as ActiveSection,
    title: 'Perfiles',
    icon: Users,
    description: 'Perfiles, delegaciones, sistema',
  },
];

export function AppSidebar({
  activeSection,
  onSectionChange,
  jsonData,
  firebaseConnected,
  saveStatus,
  dirty,
}: AppSidebarProps) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed";

  const handleSectionChange = (section: ActiveSection) => {
    onSectionChange(section);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const getSectionHasData = (sectionId: ActiveSection): boolean => {
    if (sectionId === 'notifications') return true;
    const sectionData = jsonData[sectionId as keyof JSONData];
    if (!sectionData) return false;
    if (sectionId === 'app') {
      return Object.keys((sectionData as any).feedback || {}).length > 0;
    }
    if (sectionId === 'profileConfig') {
      return !!(sectionData as any).data;
    }
    if ((sectionData as any).data) {
      return Array.isArray((sectionData as any).data)
        ? (sectionData as any).data.length > 0
        : Object.keys((sectionData as any).data).length > 0;
    }
    return Object.keys(sectionData).length > 0;
  };

  const SaveIcon = () => {
    if (saveStatus === 'saving') return <Loader2 className="w-3 h-3 animate-spin text-primary" />;
    if (saveStatus === 'saved' && !dirty) return <CheckCircle2 className="w-3 h-3 text-success" />;
    if (saveStatus === 'error') return <AlertCircle className="w-3 h-3 text-destructive" />;
    if (dirty) return <Cloud className="w-3 h-3 text-warning animate-pulse" />;
    return <Cloud className="w-3 h-3 text-muted-foreground/50" />;
  };

  const saveLabel = () => {
    if (saveStatus === 'saving') return 'Guardando…';
    if (saveStatus === 'saved' && !dirty) return 'Guardado';
    if (saveStatus === 'error') return 'Error al guardar';
    if (dirty) return 'Cambios pendientes';
    return 'Sin cambios';
  };

  return (
    <Sidebar className="border-r border-border/40 bg-sidebar">
      {/* Logo / Header */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-4 border-b border-border/40",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-none">MCM Panel</p>
            <p className="text-xs text-muted-foreground mt-0.5">MCM App Admin</p>
          </div>
        )}
      </div>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup className="p-0">
          {!collapsed && (
            <SidebarGroupLabel className="px-2 mb-2 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
              Secciones
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = activeSection === item.id;
                const hasData = getSectionHasData(item.id);

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleSectionChange(item.id)}
                      tooltip={collapsed ? item.title : undefined}
                      className={cn(
                        "relative group w-full rounded-lg transition-all duration-150",
                        collapsed ? "justify-center px-2 py-2 h-10" : "px-3 py-2 h-auto min-h-10",
                        isActive
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {/* Active left bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary" />
                      )}

                      <item.icon className={cn(
                        "flex-shrink-0 transition-colors",
                        collapsed ? "w-5 h-5" : "w-4 h-4",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />

                      {!collapsed && (
                        <div className="flex-1 min-w-0 ml-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn(
                              "text-sm font-medium leading-none",
                              isActive ? "text-primary" : ""
                            )}>
                              {item.title}
                            </span>
                            {item.id !== 'notifications' && (
                              <span className={cn(
                                "flex-shrink-0 w-1.5 h-1.5 rounded-full transition-colors",
                                hasData ? "bg-success/70" : "bg-muted-foreground/25"
                              )} />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground/60 mt-0.5 leading-none truncate">
                            {item.description}
                          </p>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: connection + save status */}
      <SidebarFooter className="px-3 py-3 border-t border-border/40">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
              firebaseConnected ? "bg-success animate-pulse-subtle" : "bg-destructive/70"
            )} />
            <SaveIcon />
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Firebase connection */}
            <div className="flex items-center gap-2 px-1">
              <div className={cn(
                "flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all",
                firebaseConnected
                  ? "bg-success animate-pulse-subtle"
                  : "bg-destructive/70"
              )} />
              <span className="text-xs text-muted-foreground/60 truncate">
                {firebaseConnected ? "Firebase conectado" : "Sin conexión"}
              </span>
            </div>

            {/* Save status */}
            <div className="flex items-center gap-2 px-1">
              <SaveIcon />
              <span className={cn(
                "text-xs truncate",
                saveStatus === 'saving' ? "text-primary/70" :
                saveStatus === 'error' ? "text-destructive/70" :
                dirty ? "text-warning/70" :
                "text-muted-foreground/50"
              )}>
                {saveLabel()}
              </span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
