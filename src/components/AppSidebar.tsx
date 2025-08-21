import {
  Sidebar,
  SidebarContent,
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
  ChevronRight,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveSection, JSONData } from "./JSONManager";

interface AppSidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  jsonData: JSONData;
}

const menuItems = [
  {
    id: 'app' as ActiveSection,
    title: 'App',
    icon: Database,
    description: 'Feedback y configuración'
  },
  {
    id: 'albums' as ActiveSection,
    title: 'Albums',
    icon: Images,
    description: 'Gestión de álbumes'
  },
  {
    id: 'calendars' as ActiveSection,
    title: 'Calendars',
    icon: Calendar,
    description: 'Configuración de calendarios'
  },
  {
    id: 'songs' as ActiveSection,
    title: 'Cantoral',
    icon: Music,
    description: 'Canciones y repertorio'
  },
  {
    id: 'wordle' as ActiveSection,
    title: 'Wordle',
    icon: Gamepad2,
    description: 'Palabras diarias'
  },
  {
    id: 'jubileo' as ActiveSection,
    title: 'Jubileo',
    icon: Trophy,
    description: 'Eventos especiales'
  },
];

export function AppSidebar({ activeSection, onSectionChange, jsonData }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const getSectionStatus = (sectionId: ActiveSection) => {
    const sectionData = jsonData[sectionId];
    if (!sectionData) return 'empty';
    
    if (sectionId === 'app') {
      const feedbackCount = Object.keys(sectionData.feedback || {}).reduce((total, category) => {
        return total + Object.keys(sectionData.feedback[category] || {}).length;
      }, 0);
      return feedbackCount > 0 ? 'active' : 'empty';
    }
    
    if (sectionData.data) {
      return Array.isArray(sectionData.data) ? 
        sectionData.data.length > 0 ? 'active' : 'empty' :
        Object.keys(sectionData.data).length > 0 ? 'active' : 'empty';
    }
    
    return Object.keys(sectionData).length > 0 ? 'active' : 'empty';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-accent/20 border-accent/30';
      case 'empty': return 'bg-muted/20 border-muted/30';
      default: return 'bg-muted/20 border-muted/30';
    }
  };

  return (
    <Sidebar className={cn("border-r border-border/50 bg-card/30 backdrop-blur-sm", collapsed ? "w-16" : "w-64")}>
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-4 text-primary font-bold flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            {!collapsed && "Secciones"}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {menuItems.map((item) => {
                const isActive = activeSection === item.id;
                const status = getSectionStatus(item.id);
                
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onSectionChange(item.id)}
                      className={cn(
                        "relative group transition-all duration-200 rounded-lg border",
                        isActive 
                          ? "bg-primary/10 border-primary/30 text-primary shadow-glow" 
                          : getStatusColor(status),
                        "hover:bg-primary/5 hover:border-primary/20"
                      )}
                    >
                      <div className="flex items-center w-full">
                        <item.icon className={cn(
                          "w-5 h-5 transition-colors",
                          isActive ? "text-primary" : "text-foreground/70"
                        )} />
                        
                        {!collapsed && (
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">{item.title}</span>
                              <ChevronRight className={cn(
                                "w-4 h-4 transition-all duration-200",
                                isActive ? "rotate-90 text-primary" : "text-muted-foreground group-hover:translate-x-1"
                              )} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {item.description}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-primary opacity-5 rounded-lg" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}