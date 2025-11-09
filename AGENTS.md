# MCM Panel - Development Guidelines for AI Agents

> **Last Updated**: 2025-11-09
> **Project**: MCM Panel - Data Management Dashboard
> **Stack**: React + TypeScript + Vite + Firebase + shadcn-ui

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Technology Stack](#technology-stack)
5. [Development Commands](#development-commands)
6. [Coding Standards](#coding-standards)
7. [Component Patterns](#component-patterns)
8. [Firebase Integration](#firebase-integration)
9. [State Management](#state-management)
10. [Testing Guidelines](#testing-guidelines)
11. [Common Tasks](#common-tasks)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

**MCM Panel** is an admin dashboard built with Lovable for managing content in the MCM App ecosystem. It handles:
- **8 main sections**: App feedback, Albums, Calendars, Cantoral (Songs), Wordle, Jubileo, Activities, Notifications
- **Real-time sync** via Firebase Realtime Database
- **Auto-save** functionality (every 10 seconds)
- **Drag-and-drop** reordering with @hello-pangea/dnd
- **Modern UI** with glass-morphism design and shadcn-ui components

**Deployed on**: Lovable Platform
**Project URL**: https://lovable.dev/projects/5efd2fe3-ad2f-4107-bbba-d24bb146e5f2

---

## Quick Start

```bash
# Install dependencies
npm i

# Start dev server (http://localhost:8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

---

## Project Structure

```
mcmpanel/
├── src/
│   ├── components/
│   │   ├── ui/                          # 40+ shadcn-ui components
│   │   │   ├── button.tsx               # Button primitive
│   │   │   ├── card.tsx                 # Card container
│   │   │   ├── dialog.tsx               # Modal dialog
│   │   │   ├── sidebar.tsx              # Navigation sidebar
│   │   │   ├── toast.tsx                # Toast notifications
│   │   │   └── ...                      # All other UI primitives
│   │   │
│   │   ├── sections/                    # Feature sections (main app modules)
│   │   │   ├── AlbumsSection.tsx        # Photo album management
│   │   │   ├── AppSection.tsx           # App feedback (bugs, suggestions)
│   │   │   ├── CalendarsSection.tsx     # Calendar configuration
│   │   │   ├── SongsSection.tsx         # Song/Cantoral management
│   │   │   ├── WordleSection.tsx        # Daily Wordle word management
│   │   │   ├── JubileoSection.tsx       # Jubilee 2025 content
│   │   │   ├── NotificationsSection.tsx # Push notification management
│   │   │   ├── ActivitiesSection.tsx    # Activities hub (routing)
│   │   │   └── activities/              # Activity subsections
│   │   │       ├── AppsSubsection.tsx           # Recommended apps
│   │   │       ├── CompartiendoSubsection.tsx   # Shared posts
│   │   │       ├── ContactosSubsection.tsx      # Contact directory
│   │   │       ├── GruposSubsection.tsx         # Group management
│   │   │       ├── HorarioSubsection.tsx        # Event schedule
│   │   │       ├── MaterialesSubsection.tsx     # Resource library
│   │   │       ├── ProfundizaSubsection.tsx     # Deep-dive content
│   │   │       └── VisitasSubsection.tsx        # Places/visits
│   │   │
│   │   ├── AppSidebar.tsx               # Main navigation sidebar
│   │   └── JSONManager.tsx              # Root manager component
│   │
│   ├── pages/
│   │   ├── Index.tsx                    # Home page (renders JSONManager)
│   │   └── NotFound.tsx                 # 404 page
│   │
│   ├── hooks/
│   │   ├── use-toast.ts                 # Toast notification hook
│   │   └── use-mobile.tsx               # Mobile detection hook
│   │
│   ├── lib/
│   │   ├── firebase.ts                  # Firebase initialization & config
│   │   └── utils.ts                     # Utility functions (cn, etc.)
│   │
│   ├── App.tsx                          # Root app component with routing
│   ├── main.tsx                         # React entry point
│   └── vite-env.d.ts                    # Vite environment types
│
├── public/                              # Static assets (icons, manifest)
├── index.html                           # HTML entry point
├── package.json                         # Dependencies & scripts
├── vite.config.ts                       # Vite build config
├── tailwind.config.ts                   # Tailwind design tokens
├── tsconfig.json                        # TypeScript config
├── eslint.config.js                     # ESLint rules
├── components.json                      # shadcn-ui config
├── AGENTS.md                            # This file
└── CLAUDE.md                            # Project context for AI
```

**Path Alias:**
- `@/` maps to `src/` directory
- Example: `import { Button } from "@/components/ui/button"`
- Configured in `tsconfig.json` and `vite.config.ts`

---

## Technology Stack

### Core Framework
- **React 18.3.1** - UI library with functional components + hooks
- **TypeScript 5.8.3** - Type-safe JavaScript with strict mode
- **Vite 6.1.4** - Fast build tool with HMR and optimized bundling

### UI & Styling
- **shadcn-ui** - Headless component library (40+ components)
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library (600+ icons)
- **class-variance-authority** - Variant-based component styling
- **tailwind-merge** - Smart Tailwind class merging

### State & Data Management
- **@tanstack/react-query 5.83.0** - Server state management & caching
- **Firebase 10.14.1** - Realtime Database for persistence
- **React Router DOM 6.30.1** - Client-side routing
- **React Hook Form 7.61.1** - Form state with validation
- **Zod 3.25.76** - Schema validation & type inference

### UI Features
- **@hello-pangea/dnd** - Drag-and-drop lists (fork of react-beautiful-dnd)
- **Embla Carousel** - Carousel component
- **Recharts** - Data visualization & charts
- **Sonner** - Toast notifications
- **Vaul** - Drawer/modal component
- **React Resizable Panels** - Draggable panel layout
- **date-fns** - Date manipulation utilities

### Development Tools
- **ESLint 9.32.0** - Code quality & linting
- **@vitejs/plugin-react-swc** - Fast React compilation with SWC
- **Lovable Tagger** - Component tagging for Lovable platform
- **Autoprefixer** - CSS vendor prefixes
- **PostCSS** - CSS transformations

---

## Development Commands

### Essential Commands
```bash
npm i                # Install all dependencies
npm run dev          # Start dev server at http://localhost:8080
npm run build        # Production build → dist/
npm run build:dev    # Development build (preserves debug info)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint checks
```

### Environment Setup
1. Create `.env.local` in project root
2. Add Firebase credentials (all prefixed with `VITE_`):
   ```
   VITE_API_KEY=your-firebase-api-key
   VITE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-db.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```
3. **Never commit `.env.local`** - it's in `.gitignore`

---

## Coding Standards

### TypeScript Guidelines
- **Use strict TypeScript** - no `any` types unless absolutely necessary
- **Prefer interfaces for props**, type aliases for unions/intersections
- **Export types alongside components** for reusability
- **Use Zod schemas** for runtime validation when accepting external data

```typescript
// ✅ Good - named export with interface
interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon }) => {
  return <Card>...</Card>;
};

// ❌ Avoid - default export, inline types
export default ({ title, description }: { title: string; description: string }) => {
  return <Card>...</Card>;
};
```

### Naming Conventions
- **Components**: PascalCase (`FeatureCard.tsx`, `AlbumsSection.tsx`)
- **Hooks**: camelCase with `use` prefix (`useToast.ts`, `useMobile.tsx`)
- **Utilities**: camelCase (`firebase.ts`, `utils.ts`)
- **Constants**: UPPER_SNAKE_CASE (`const MAX_RETRIES = 3`)
- **Variables/functions**: camelCase (`userData`, `fetchAlbums`)

### File Organization
- **Co-locate related files** - keep subsections near their parent
- **Group by feature**, not by type (components/sections, not components/buttons)
- **One component per file** unless they're tightly coupled
- **Export at bottom** for better readability

### Styling with Tailwind
```tsx
// ✅ Good - semantic grouping, responsive utilities
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow md:flex-row md:p-8">

// ❌ Avoid - unsorted, hard to scan
<div className="p-6 transition-shadow bg-white md:p-8 flex shadow-md rounded-lg gap-4 md:flex-row hover:shadow-lg flex-col">
```

**Class order convention:**
1. Layout (flex, grid, display)
2. Positioning (relative, absolute)
3. Sizing (w-, h-, max-, min-)
4. Spacing (p-, m-, gap-)
5. Typography (text-, font-)
6. Colors (bg-, text-, border-)
7. Effects (shadow-, opacity-, transition-)
8. Responsive variants (md:, lg:)

### React Best Practices
- **Use functional components** with hooks (no class components)
- **Prefer named exports** over default exports
- **Extract custom hooks** for reusable logic
- **Memoize expensive computations** with `useMemo`
- **Use `useCallback`** for functions passed to optimized child components
- **Keep components small** - split if >200 lines

---

## Component Patterns

### Section Component Pattern
All main sections follow this structure:

```typescript
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SectionData {
  // Define your data structure
}

export const MySection = () => {
  const [data, setData] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load data from Firebase
  useEffect(() => {
    // Firebase listener setup
  }, []);

  // Handle CRUD operations
  const handleAdd = () => { /* ... */ };
  const handleEdit = (id: string) => { /* ... */ };
  const handleDelete = (id: string) => { /* ... */ };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {/* Icon + Title */}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Section content */}
      </CardContent>
    </Card>
  );
};
```

### shadcn-ui Component Usage
```tsx
// Always import from @/components/ui
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Use variants for consistent styling
<Button variant="default">Primary Action</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="destructive">Delete</Button>

// Combine with Tailwind for custom spacing/sizing
<Button className="w-full mt-4">Full Width Button</Button>
```

### Form Handling Pattern
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export const MyForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormData) => {
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register("title")} placeholder="Title" />
      {errors.title && <span className="text-red-500">{errors.title.message}</span>}
      <Button type="submit">Submit</Button>
    </form>
  );
};
```

---

## Firebase Integration

### Configuration
- **File**: `src/lib/firebase.ts`
- **Type**: Realtime Database (not Firestore)
- **Auth**: Not implemented yet (no authentication layer)

### Data Operations
```typescript
import { ref, set, get, update, remove, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

// Read data (one-time)
const snapshot = await get(ref(db, "path/to/data"));
const data = snapshot.val();

// Read data (real-time listener)
const dataRef = ref(db, "path/to/data");
onValue(dataRef, (snapshot) => {
  const data = snapshot.val();
  // Update state
});

// Write data
await set(ref(db, "path/to/data"), { key: "value" });

// Update partial data
await update(ref(db, "path/to/data"), { field: "newValue" });

// Delete data
await remove(ref(db, "path/to/data"));
```

### Database Structure
```
firebase-root/
├── app/                  # App feedback (bugs, suggestions, congratulations)
├── albums/               # Photo albums
├── calendars/            # Calendar configurations
├── songs/                # Cantoral (song list)
├── wordle/               # Daily Wordle words
├── jubileo/              # Jubilee 2025 content
├── activities/           # Activities section
│   ├── apps/
│   ├── compartiendo/
│   ├── contactos/
│   ├── grupos/
│   ├── horario/
│   ├── materiales/
│   ├── profundiza/
│   └── visitas/
└── notifications/        # Push notifications
```

### Auto-save Pattern
```typescript
// JSONManager.tsx implements auto-save every 10 seconds
useEffect(() => {
  const timer = setInterval(() => {
    saveToFirebase(); // Sync current state to Firebase
  }, 10000); // 10 seconds

  return () => clearInterval(timer);
}, [data]);
```

---

## State Management

### Local Component State
Use `useState` for component-specific state:
```typescript
const [isOpen, setIsOpen] = useState(false);
const [data, setData] = useState<DataType[]>([]);
```

### Firebase Real-time State
Use `onValue` listeners for server-synced state:
```typescript
useEffect(() => {
  const dataRef = ref(db, "path/to/data");
  const unsubscribe = onValue(dataRef, (snapshot) => {
    setData(snapshot.val() || []);
  });

  return () => unsubscribe(); // Cleanup on unmount
}, []);
```

### Form State
Use `react-hook-form` for complex forms:
```typescript
const { register, handleSubmit, reset, formState: { errors } } = useForm();
```

### Toast Notifications
Use `useToast` hook for user feedback:
```typescript
const { toast } = useToast();

toast({
  title: "Success",
  description: "Data saved successfully",
});

toast({
  title: "Error",
  description: "Failed to save data",
  variant: "destructive",
});
```

---

## Testing Guidelines

### Current Status
- **No formal test suite** currently implemented
- Validate changes manually via `npm run dev` + smoke testing

### Recommended Testing Setup (Future)
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Test file naming**: `ComponentName.test.tsx` next to component

**Example test structure**:
```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FeatureCard } from "./FeatureCard";

describe("FeatureCard", () => {
  it("renders title and description", () => {
    render(<FeatureCard title="Test" description="Description" />);
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
});
```

### Manual Testing Checklist
Before committing major changes:
- ✅ Run `npm run dev` and verify no console errors
- ✅ Test key user flows in each affected section
- ✅ Check responsive design (mobile, tablet, desktop)
- ✅ Verify Firebase sync works (check Firebase console)
- ✅ Run `npm run build` and `npm run preview` to test production build
- ✅ Run `npm run lint` and fix all errors

---

## Common Tasks

### Adding a New Section
1. Create component in `src/components/sections/NewSection.tsx`
2. Follow the Section Component Pattern (see above)
3. Add icon import from `lucide-react`
4. Register in `AppSidebar.tsx`:
   ```tsx
   {
     title: "New Section",
     icon: IconName,
     isActive: activeSection === "new-section",
     onClick: () => setActiveSection("new-section"),
   }
   ```
5. Add route in `JSONManager.tsx`:
   ```tsx
   {activeSection === "new-section" && <NewSection />}
   ```
6. Create Firebase node if needed

### Adding a New UI Component
```bash
# Use shadcn-ui CLI to add components
npx shadcn-ui@latest add [component-name]

# Example: add select component
npx shadcn-ui@latest add select
```

### Updating Dependencies
```bash
# Check for outdated packages
npm outdated

# Update specific package
npm install package@latest

# Update all (use cautiously)
npm update
```

### Adding Environment Variables
1. Add to `.env.local` with `VITE_` prefix
2. Access in code: `import.meta.env.VITE_YOUR_VAR`
3. Add TypeScript types in `src/vite-env.d.ts` if needed

---

## Troubleshooting

### Common Issues

**Issue**: Port 8080 already in use
**Solution**:
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9
# Or change port in vite.config.ts
```

**Issue**: Firebase connection errors
**Solution**:
- Verify `.env.local` has all required `VITE_*` variables
- Check Firebase console for database rules
- Ensure Realtime Database (not Firestore) is enabled

**Issue**: TypeScript errors after adding dependencies
**Solution**:
```bash
# Restart TypeScript server in editor
# Or rebuild type cache
rm -rf node_modules/.vite
npm run dev
```

**Issue**: Tailwind classes not applying
**Solution**:
- Check `tailwind.config.ts` content paths include your file
- Restart dev server
- Use `className` not `class`

**Issue**: Component not hot-reloading
**Solution**:
- Ensure component is exported (not inline)
- Check for syntax errors in console
- Restart dev server

---

## Commit & Pull Request Guidelines

### Commit Message Format
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only
- `style`: Code style changes (formatting, semicolons, etc.)
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies

**Examples:**
```
feat(albums): add drag-and-drop reordering
fix(firebase): handle connection timeout gracefully
docs(readme): update installation instructions
refactor(sections): extract common form logic to hook
```

### Pull Request Checklist
- [ ] Code follows TypeScript & Tailwind conventions
- [ ] ESLint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing completed on dev server
- [ ] Screenshots included for UI changes
- [ ] Related issues linked
- [ ] Clear description of changes and testing steps

---

## Security Best Practices

### Environment Variables
- ✅ **Always** use `.env.local` for secrets
- ✅ Prefix client-safe vars with `VITE_`
- ❌ **Never** commit `.env.local` or `.env`
- ❌ **Never** hardcode API keys in source code

### Firebase Security
- Review Firebase Database Rules regularly
- Implement authentication before production (currently none!)
- Use environment-specific Firebase projects (dev/staging/prod)

### Dependencies
- Run `npm audit` regularly to check for vulnerabilities
- Keep dependencies updated (especially security patches)
- Review dependency licenses for compliance

---

## Design System

### Design Tokens (Tailwind Config)
- **Colors**: Defined in `tailwind.config.ts` (primary, accent, muted, etc.)
- **Spacing**: Default Tailwind scale (0.5, 1, 2, 4, 8, 12, 16...)
- **Border Radius**: `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`
- **Shadows**: `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`

### UI Patterns
- **Glass-morphism**: `backdrop-blur-sm bg-white/90`
- **Gradients**: Defined in Tailwind config
- **Dark Mode**: Supported via `dark:` variants (check `index.html` for color-scheme)
- **Animations**: Use `transition-*` utilities, define custom in config if needed

---

## Resources

- **Lovable Docs**: https://docs.lovable.dev
- **shadcn-ui**: https://ui.shadcn.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Query**: https://tanstack.com/query/latest/docs
- **Firebase Realtime DB**: https://firebase.google.com/docs/database
- **Radix UI**: https://www.radix-ui.com/primitives
- **Lucide Icons**: https://lucide.dev/icons

---

**Questions or issues?** Review this guide, check existing code patterns, or consult the official documentation for the relevant technology.
