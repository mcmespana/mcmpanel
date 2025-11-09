# MCM Panel - Project Context for Claude

> **Purpose**: This file provides high-level context about the MCM Panel project to help Claude Code understand the business domain, architecture, and development priorities.

---

## Project Mission

**MCM Panel** is the central administration dashboard for managing all content in the **MCM App** ecosystem - a mobile application serving a Catholic youth community. The panel enables content managers to update albums, songs, calendars, activities, and Jubilee 2025 content in real-time without requiring app updates.

### Core Objectives
1. **Simplify content management** - Non-technical staff can update app content via intuitive web interface
2. **Real-time synchronization** - Changes propagate instantly to all mobile app users via Firebase
3. **Prevent app updates** - All content is dynamic; no app store deployments needed for content changes
4. **Centralize administration** - Single dashboard for all MCM App features

---

## Business Context

### Target Users
- **Primary**: MCM App content managers and administrators (internal team)
- **Secondary**: Mobile app end-users (consume data managed through this panel)

### Key Use Cases
1. **Daily Operations**:
   - Update daily Wordle word for game feature
   - Post new photo albums from events
   - Send push notifications for important announcements
   - Update activity schedules and contact information

2. **Event Management**:
   - Configure calendars for upcoming retreats and gatherings
   - Update activity materials and deep-dive content
   - Manage group organization and visit locations

3. **Special Campaigns**:
   - Jubilee 2025 content management (dedicated section for this initiative)
   - Seasonal content updates (Advent, Lent, Easter)

### Business Value
- **Time Savings**: ~80% reduction in content update time (from app store deployments to instant updates)
- **Flexibility**: Content can be updated daily without technical dependency
- **User Engagement**: Fresh content keeps mobile app users engaged

---

## System Architecture

### High-Level Flow
```
[Content Manager]
    ↓ (edits via web UI)
[MCM Panel (React App)]
    ↓ (saves to)
[Firebase Realtime Database]
    ↓ (syncs to)
[MCM Mobile App] → [End Users]
```

### Key Technologies

**Frontend Stack**:
- **React 18** + **TypeScript** - Modern, type-safe component architecture
- **Vite** - Fast development and optimized production builds
- **shadcn-ui** + **Tailwind** - Consistent, accessible UI components
- **React Query** - Server state management and caching

**Backend/Database**:
- **Firebase Realtime Database** - NoSQL cloud database with real-time sync
- **Auto-save mechanism** - Writes to Firebase every 10 seconds
- **No authentication layer yet** - TODO: Add Firebase Auth before public launch

**Deployment**:
- **Lovable Platform** - Hosting and continuous deployment
- **Development**: `npm run dev` (localhost:8080)
- **Production**: Automated builds via Lovable

### Data Architecture

The application manages **8 primary data domains**:

| Domain | Firebase Path | Purpose | Data Type |
|--------|--------------|---------|-----------|
| App Feedback | `/app` | Bug reports, suggestions, congratulations | Array of feedback objects |
| Albums | `/albums` | Photo galleries from events | Array of album objects with image URLs |
| Calendars | `/calendars` | Event calendars and schedules | Array of calendar configs |
| Songs (Cantoral) | `/songs` | Song library for community singing | Array of song objects with lyrics |
| Wordle | `/wordle` | Daily word game words | Array of word strings |
| Jubileo | `/jubileo` | Jubilee 2025 special content | Nested object with sections |
| Activities | `/activities/*` | 8 subsections (apps, compartiendo, contactos, grupos, horario, materiales, profundiza, visitas) | Nested objects per subsection |
| Notifications | `/notifications` | Push notification history | Array of notification objects |

**Data Sync Pattern**:
- **Real-time listeners** (`onValue`) keep UI in sync with Firebase
- **Optimistic updates** - UI updates immediately, syncs to Firebase
- **Auto-save interval** - Every 10 seconds for unsaved changes
- **Manual save option** - Users can trigger immediate save

---

## Development Priorities

### Current Focus (Sprint Goals)
1. **Stability & Performance**:
   - Ensure Firebase sync is reliable under slow connections
   - Optimize bundle size (currently ~2MB, target <1.5MB)
   - Add error boundaries to prevent full app crashes

2. **User Experience**:
   - Improve loading states (skeletons instead of spinners)
   - Add undo/redo functionality for critical operations
   - Implement keyboard shortcuts for power users

3. **Feature Completeness**:
   - Complete Jubileo section with all subsections
   - Add image upload capability (currently external URLs only)
   - Implement rich text editor for long-form content

### Technical Debt
- ⚠️ **No authentication** - Firebase Database currently open (secured by obscurity)
- ⚠️ **No tests** - Zero test coverage, relying on manual QA
- ⚠️ **No error tracking** - No Sentry or similar service
- ⚠️ **Hardcoded strings** - No i18n/localization (Spanish only)

### Planned Improvements
- [ ] Add Firebase Authentication (Google Sign-In for admins)
- [ ] Implement Firestore for better querying (migrate from Realtime DB)
- [ ] Add unit tests with Vitest + React Testing Library
- [ ] Set up Sentry for error monitoring
- [ ] Add image upload to Firebase Storage
- [ ] Implement audit log (track who changed what, when)
- [ ] Add draft/publish workflow (currently all changes are live)

---

## Code Organization Philosophy

### Component Hierarchy
```
App.tsx (routing + providers)
└── pages/Index.tsx
    └── JSONManager.tsx (orchestrator)
        ├── AppSidebar.tsx (navigation)
        └── Sections (8 main features)
            ├── AppSection.tsx
            ├── AlbumsSection.tsx
            ├── CalendarsSection.tsx
            ├── SongsSection.tsx
            ├── WordleSection.tsx
            ├── JubileoSection.tsx
            ├── ActivitiesSection.tsx
            │   └── activities/* (8 subsections)
            └── NotificationsSection.tsx
```

### Design Patterns
- **Container/Presenter**: Sections handle data logic, UI components are presentational
- **Composition over inheritance**: Build complex UIs from small, reusable components
- **Hooks for logic reuse**: Extract common patterns (Firebase CRUD, form handling) into custom hooks
- **Co-location**: Keep related files close (subsections near parent section)

---

## Development Workflow

### Daily Development
1. **Pull latest changes**: `git pull origin main`
2. **Start dev server**: `npm run dev`
3. **Make changes** with hot-reload feedback
4. **Test manually** - verify Firebase sync works
5. **Commit** with conventional commit message
6. **Push** to branch, create PR

### Pre-Push Checklist
```bash
npm run lint           # Fix all ESLint errors
npm run build          # Ensure production build succeeds
npm run preview        # Smoke test production build
```

### Code Review Criteria
- ✅ Follows TypeScript strict mode (no `any`)
- ✅ Uses shadcn-ui components (no custom unstyled divs)
- ✅ Tailwind classes follow ordering convention
- ✅ Firebase operations have error handling
- ✅ User feedback via toast notifications
- ✅ No console.log statements (use proper logging)
- ✅ Accessible (keyboard navigation, ARIA labels)

---

## Domain-Specific Knowledge

### Jubileo 2025
The **Jubilee 2025** is a special Holy Year proclaimed by the Pope. MCM App has dedicated content for this event including:
- Pilgrimages and sacred sites
- Special prayers and reflections
- Event calendar for Jubilee activities
- Educational materials about the Jubilee

**Data Structure** (Firebase `/jubileo`):
```json
{
  "intro": "Welcome text",
  "sections": [
    { "title": "...", "content": "...", "image": "..." }
  ],
  "events": [
    { "date": "...", "title": "...", "location": "..." }
  ]
}
```

### Cantoral (Songs)
The **Cantoral** is a collection of Catholic hymns and songs used in community gatherings. Managed in the **Songs section**.

**Data Structure** (Firebase `/songs`):
```json
[
  {
    "id": "song-1",
    "title": "Song Title",
    "artist": "Artist Name",
    "lyrics": "Full lyrics...",
    "category": "praise|worship|adoration",
    "youtubeUrl": "https://..."
  }
]
```

### Activities Subsections
- **Apps**: Recommended Catholic/spiritual mobile apps
- **Compartiendo**: User-generated content sharing (posts, testimonies)
- **Contactos**: Directory of community leaders and contacts
- **Grupos**: Small group organization and schedules
- **Horario**: Master schedule of all events
- **Materiales**: Downloadable resources (PDFs, worksheets)
- **Profundiza**: Deep-dive theological content
- **Visitas**: Sacred places and pilgrimage sites

---

## Non-Functional Requirements

### Performance Targets
- **Initial Load**: <3 seconds on 3G
- **Time to Interactive**: <5 seconds
- **Firebase Sync Latency**: <500ms
- **Build Time**: <30 seconds

### Browser Support
- **Primary**: Chrome, Firefox, Safari (latest 2 versions)
- **Mobile**: Safari iOS 14+, Chrome Android 90+
- **No IE11 support** (modern ES6+ features used)

### Accessibility (WCAG 2.1)
- **Level AA compliance** target
- Keyboard navigation for all interactive elements
- Screen reader compatible (ARIA labels)
- Color contrast ratios meet standards

### Security
- **HTTPS only** in production
- **No sensitive PII stored** (only content data)
- **Firebase rules** restrict database access (TODO: implement properly)
- **CSP headers** via Lovable platform

---

## Common Pain Points & Solutions

### Pain Point: Firebase Sync Conflicts
**Problem**: Multiple admins editing same content simultaneously
**Current Solution**: Last write wins (not ideal)
**Future Solution**: Implement operational transforms or lock mechanism

### Pain Point: Image Management
**Problem**: External image URLs can break (403, expired links)
**Current Solution**: Manual URL updates
**Future Solution**: Upload to Firebase Storage with CDN

### Pain Point: No Version History
**Problem**: Can't rollback accidental deletions
**Current Solution**: Manual Firebase console recovery
**Future Solution**: Implement audit log with restore functionality

### Pain Point: Mobile Responsiveness
**Problem**: Some sections hard to use on small screens
**Current Solution**: Tailwind responsive utilities
**Future Solution**: Dedicated mobile layout for common tasks

---

## Key Files to Understand

If you're new to the codebase, start here:

1. **`src/App.tsx`** - Application entry point, routing setup
2. **`src/components/JSONManager.tsx`** - Main orchestrator, section routing
3. **`src/components/AppSidebar.tsx`** - Navigation structure
4. **`src/lib/firebase.ts`** - Firebase initialization and config
5. **`src/components/sections/AlbumsSection.tsx`** - Reference implementation for CRUD patterns
6. **`tailwind.config.ts`** - Design tokens and theme
7. **`vite.config.ts`** - Build configuration

---

## Glossary

- **MCM**: Name of the Catholic youth community organization
- **Cantoral**: Spanish for "hymnal" or "songbook"
- **Jubileo**: Spanish for "Jubilee" (Catholic Holy Year)
- **Compartiendo**: Spanish for "sharing"
- **Profundiza**: Spanish for "deepen/dive deeper"
- **Lovable**: The platform hosting this application (lovable.dev)
- **shadcn-ui**: Component library built on Radix UI primitives
- **Firebase Realtime DB**: NoSQL database with WebSocket sync (different from Firestore)

---

## Success Metrics

### User Adoption
- **Daily Active Users**: 5-10 content managers
- **Session Duration**: 10-30 minutes per session
- **Update Frequency**: 15-20 updates per day

### Technical Metrics
- **Uptime**: 99.5% (Lovable platform SLA)
- **Error Rate**: <1% of requests
- **Firebase Reads**: ~50k/day, Writes: ~500/day
- **Bundle Size**: 2.1 MB (target: <1.5 MB)

### Business Outcomes
- **Content Freshness**: New content daily (vs. weekly before panel)
- **Admin Time Saved**: ~10 hours/week
- **App Store Dependencies**: Zero content updates via app store

---

## Questions to Ask When Making Changes

1. **Data integrity**: Will this affect existing Firebase data structure?
2. **Backwards compatibility**: Will mobile app users on old versions still work?
3. **Performance**: Does this add significant bundle size or runtime cost?
4. **Accessibility**: Can this be used with keyboard only? With screen reader?
5. **Mobile UX**: Does this work well on small screens?
6. **Error handling**: What happens if Firebase is offline or slow?
7. **User feedback**: Does the user know the operation succeeded/failed?
8. **Security**: Does this expose sensitive data or create vulnerabilities?

---

## When in Doubt...

- **Follow existing patterns** - Look at `AlbumsSection.tsx` for CRUD operations
- **Use shadcn-ui components** - Don't reinvent UI primitives
- **Add toast notifications** - Users need feedback on actions
- **Handle loading states** - Show spinners/skeletons during async operations
- **Test with Firebase offline** - Use Chrome DevTools to simulate offline
- **Ask for clarification** - Better to ask than break production data

---

**This document evolves with the project. Keep it updated as architecture and priorities change.**
