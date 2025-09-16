# Library IDs for Context7

This file maintains a list of Context7-compatible library IDs that have been searched and resolved.

## Supabase
- Library ID: /supabase/supabase
- Description: The open source Firebase alternative. Comprehensive Supabase documentation.
- Code Snippets: 5273
- Trust Score: 9.5
- Alternative IDs:
  - /supabase/auth (Auth-specific documentation)
  - /supabase/ui (UI Library)
  - /supabase/ssr (Server-side rendering)

## Next.js
- Library ID: /vercel/next.js
- Description: The React Framework
- Code Snippets: 4511
- Trust Score: 10
- Versions: v14.3.0-canary.87, v13.5.11, v15.1.8

## WebSockets
- Library ID: /websockets/ws
- Description: Simple to use, blazing fast and thoroughly tested WebSocket client and server for Node.js
- Code Snippets: 23
- Trust Score: 6.7

## React
- Library ID: /reactjs/react.dev
- Description: The React documentation website
- Code Snippets: 2791
- Trust Score: 9
- Documentation Retrieved: ✅ Component patterns, TypeScript integration, prop typing, event handlers

## Google Cloud Services
- **Google Cloud Document AI**: /websites/cloud_google_com-docs
  - Description: Google Cloud Document AI for document processing and text extraction
  - Code Snippets: 68921
  - Trust Score: 7.5
  - Usage: Replaces Azure Form Recognizer

- **Google Cloud Vertex AI**: /googlecloudplatform/generative-ai
  - Description: Generative AI on Google Cloud with Vertex AI for document processing and AI workflows
  - Code Snippets: 7988
  - Trust Score: 8
  - Usage: Replaces Azure OpenAI

- **Google Cloud Vertex AI Node.js**: /googleapis/nodejs-vertexai
  - Description: Vertex AI SDK for Node.js with Gemini API support
  - Code Snippets: 19
  - Trust Score: 8.5
  - Usage: Direct integration with Gemini models

- **Vertex AI Search**: /websites/cloud_google_com-vertex-ai-generative-ai-docs-model-reference-rag-api
  - Description: Vertex AI Search for retrieval-augmented generation
  - Code Snippets: 1647
  - Trust Score: 7.5
  - Usage: Replaces Azure Search

## Other Libraries
(Add other libraries as needed)

## Documentation Retrieved
- **Authentication**: ✅ HTTP-only cookies, client/server setup, OAuth callbacks
- **Database**: RLS policies, profile tables, foreign key relationships  
- **Storage Buckets**: Bucket creation, security policies, file upload restrictions
- **React Components**: ✅ TypeScript patterns, component interfaces, event handling, children props

## Context7 Usage Log
- **Session 1 (2025-06-28)**: React component patterns research - 3000 tokens used
- **Total tokens used**: 3000/4000 (75% of session limit)

## Dependency Installation Log
### Phase 1 Dependencies Added (2025-06-28)
- **lucide-react@0.525.0** - Icon library for React components
- **swagger-ui-react@5.25.3** - API documentation interface
- **@types/swagger-ui-react@5.18.0** - TypeScript definitions
- **typescript@5.8.3** - TypeScript compiler

### React 19 Compatibility Issues
- Used `--legacy-peer-deps` for swagger-ui-react due to React <19 requirement
- lucide-react@0.525.0 supports React 19
- Ongoing peer dependency warnings expected until ecosystem catches up

## UI Component Creation Log
### Phase 2 Components Created (2025-06-28)
- **Textarea** (`components/ui/textarea.tsx`) - Multi-line text input with dark mode support
- **Switch** (`components/ui/switch.tsx`) - Toggle switch with accessibility features
- **Tabs** (`components/ui/tabs.tsx`) - Complete tabs system with context management
- **Popover** (`components/ui/popover.tsx`) - Overlay positioning system with click-outside handling

### Component Features Implemented
- React.forwardRef for proper ref forwarding
- TypeScript interfaces extending native HTML elements
- Accessibility attributes (ARIA, roles, keyboard navigation)
- Dark mode support following existing patterns
- Context-based state management for complex components
- Click-outside and escape key handling for overlays

---
*Last updated: 2025-06-28*