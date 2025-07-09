

./app/admin/dashboard/page.tsx
14:10  Warning: 'Tabs' is defined but never used.  @typescript-eslint/no-unused-vars
14:16  Warning: 'TabsContent' is defined but never used.  @typescript-eslint/no-unused-vars
14:29  Warning: 'TabsList' is defined but never used.  @typescript-eslint/no-unused-vars
14:39  Warning: 'TabsTrigger' is defined but never used.  @typescript-eslint/no-unused-vars



./app/admin/metrics/page.tsx
30:3  Warning: 'Database' is defined but never used.  @typescript-eslint/no-unused-vars
32:3  Warning: 'Clock' is defined but never used.  @typescript-eslint/no-unused-vars

./app/admin/organization/page.tsx
244:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
256:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
283:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
288:19  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
289:19  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
464:19  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
476:19  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
490:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
503:17  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control

./app/api/admin/env/route.ts
118:12  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
148:1  Error: Delete `··`  prettier/prettier
153:1  Error: Delete `··`  prettier/prettier

./app/api/admin/integrations/route.ts
135:12  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars

./app/api/admin/integrations/test/route.ts
49:12  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars
69:19  Error: Replace `⏎······.from('audit_logs')⏎······` with `.from('audit_logs')`  prettier/prettier
72:1  Error: Delete `··`  prettier/prettier
73:7  Error: Delete `··`  prettier/prettier
74:1  Error: Delete `··`  prettier/prettier
75:7  Error: Delete `··`  prettier/prettier
76:1  Error: Delete `··`  prettier/prettier
77:9  Error: Delete `··`  prettier/prettier
78:1  Error: Delete `··`  prettier/prettier
79:7  Error: Delete `··`  prettier/prettier
80:1  Error: Delete `··`  prettier/prettier

./app/api/audit-reports/[id]/pdf.ts
2:23  Warning: 'NextResponse' is defined but never used.  @typescript-eslint/no-unused-vars

./app/api/auth/login/route.ts
3:27  Warning: 'errorResponse' is defined but never used.  @typescript-eslint/no-unused-vars
6:15  Warning: 'User' is defined but never used.  @typescript-eslint/no-unused-vars

./app/api/chat/[projectId]/route.ts
12:3  Warning: 'ExternalServiceError' is defined but never used.  @typescript-eslint/no-unused-vars
98:14  Warning: 'parseError' is defined but never used.  @typescript-eslint/no-unused-vars
109:11  Warning: 'userMessage' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./app/api/documents/process/route.ts
22:12  Warning: 'error' is defined but never used.  @typescript-eslint/no-unused-vars

./app/api/documents/upload/route.ts
62:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars

./app/api/errors/__tests__/route.test.ts
104:15  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./app/api/health/route.ts
6:3  Warning: 'DatabaseError' is defined but never used.  @typescript-eslint/no-unused-vars
7:3  Warning: 'ExternalServiceError' is defined but never used.  @typescript-eslint/no-unused-vars
37:45  Warning: 'request' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
164:13  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars
198:13  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./app/api/metrics/route.ts
11:45  Warning: 'request' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/api/organizations/invite/route.ts
185:17  Error: Replace `·inv.users·&&·Array.isArray(inv.users)·&&·inv.users[0]·?·`${inv.users[0].first_name}·${inv.users[0].last_name}`` with `⏎········inv.users·&&·Array.isArray(inv.users)·&&·inv.users[0]⏎··········?·`${inv.users[0].first_name}·${inv.users[0].last_name}`⏎·········`  prettier/prettier

./app/api/organizations/route.ts
6:10  Warning: 'withErrorHandling' is defined but never used.  @typescript-eslint/no-unused-vars
68:19  Warning: 'authUser' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./app/api/reports/generate/route.ts
101:19  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
218:12  Warning: 'parseError' is defined but never used.  @typescript-eslint/no-unused-vars
237:3  Warning: 'includeCharts' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/components/AdminPanel.tsx
90:13  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

./app/components/AuditReportsList.tsx
29:16  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
107:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars

./app/components/ChatRAG.tsx
14:46  Warning: 'user' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
142:15  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
219:14  Error: Unknown property 'jsx' found  react/no-unknown-property

./app/components/CreateProjectModal.tsx
93:11  Error: Visible, non-interactive elements with click handlers must have at least one keyboard listener.  jsx-a11y/click-events-have-key-events
93:11  Error: Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element.  jsx-a11y/no-static-element-interactions

./app/components/DocumentAnalysisModal.tsx
26:21  Warning: 'setIsLoading' is assigned a value but never used.  @typescript-eslint/no-unused-vars
28:9  Warning: 'supabase' is assigned a value but never used.  @typescript-eslint/no-unused-vars
54:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
145:21  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control
161:21  Error: A form label must be associated with a control.  jsx-a11y/label-has-associated-control

./app/components/DocumentsList.tsx
31:9  Warning: 'supabase' is assigned a value but never used.  @typescript-eslint/no-unused-vars
68:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars

./app/components/ErrorBoundary.tsx
29:35  Warning: 'error' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/components/Navbar.tsx
9:15  Warning: 'User' is defined but never used.  @typescript-eslint/no-unused-vars
30:9  Warning: 'isActive' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./app/components/Sidebar.tsx
148:9  Error: The element ul has an implicit role of list. Defining this explicitly is redundant and should be avoided.  jsx-a11y/no-redundant-roles
150:13  Error: The element ul has an implicit role of list. Defining this explicitly is redundant and should be avoided.  jsx-a11y/no-redundant-roles

./app/components/SkeletonLoader.tsx
97:14  Error: Unknown property 'jsx' found  react/no-unknown-property
97:18  Error: Unknown property 'global' found  react/no-unknown-property

./app/components/UploadComponent.tsx
16:9  Warning: 'supabase' is assigned a value but never used.  @typescript-eslint/no-unused-vars
42:6  Warning: React Hook useCallback has a missing dependency: 'handleFiles'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./app/components/WebSocketProvider.tsx
81:6  Warning: React Hook useEffect has a missing dependency: 'ws'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./app/components/WelcomeModal.tsx
5:8  Warning: 'Link' is defined but never used.  @typescript-eslint/no-unused-vars

./app/dashboard/page.tsx
52:10  Warning: 'initialLoad' is assigned a value but never used.  @typescript-eslint/no-unused-vars
792:69  Warning: 'index' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
973:27  Error: Visible, non-interactive elements with click handlers must have at least one keyboard listener.  jsx-a11y/click-events-have-key-events
973:27  Error: Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element.  jsx-a11y/no-static-element-interactions
1046:30  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
1046:78  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
1047:30  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
1047:78  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
1048:30  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
1048:67  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities

./app/not-found.tsx
26:9  Error: Insert `··`  prettier/prettier

./app/projects/page.tsx
79:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
112:43  Warning: 'index' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/reset-password/page.tsx
49:44  Error: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities

./app/settings/page.tsx
20:6  Warning: React Hook useEffect has a missing dependency: 'checkUser'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./app/update-password/page.tsx
22:6  Warning: React Hook useEffect has missing dependencies: 'router' and 'supabase.auth'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps

./components/ui/alert.tsx
34:5  Error: Headings must have content and the content must be accessible by a screen reader.  jsx-a11y/heading-has-content

./components/ui/card.tsx
27:5  Error: Headings must have content and the content must be accessible by a screen reader.  jsx-a11y/heading-has-content

./components/ui/dialog.tsx
14:1  Error: Delete `··`  prettier/prettier
49:7  Error: Visible, non-interactive elements with click handlers must have at least one keyboard listener.  jsx-a11y/click-events-have-key-events
49:7  Error: Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element.  jsx-a11y/no-static-element-interactions
49:11  Error: Replace `⏎········className="fixed·inset-0·bg-black·bg-opacity-50"⏎········onClick={()·=>·setOpen(false)}⏎·····` with `·className="fixed·inset-0·bg-black·bg-opacity-50"·onClick={()·=>·setOpen(false)}`  prettier/prettier
54:38  Error: Replace `⏎········{children}⏎······` with `{children}`  prettier/prettier
76:5  Error: Visible, non-interactive elements with click handlers must have at least one keyboard listener.  jsx-a11y/click-events-have-key-events
76:5  Error: Avoid non-native interactive elements. If using native HTML is not possible, add an appropriate role and support for tabbing, mouse, keyboard, and touch inputs to an interactive content element.  jsx-a11y/no-static-element-interactions
113:5  Error: Headings must have content and the content must be accessible by a screen reader.  jsx-a11y/heading-has-content

./components/ui/input.tsx
4:18  Error: An interface declaring no members is equivalent to its supertype.  @typescript-eslint/no-empty-object-type

./components/ui/popover.tsx
29:43  Error: Replace `⏎··children,⏎··open,⏎··onOpenChange,⏎··defaultOpen·=·false,⏎` with `·children,·open,·onOpenChange,·defaultOpen·=·false·`  prettier/prettier
37:1  Error: Delete `··`  prettier/prettier
266:15  Error: Insert `··`  prettier/prettier
267:1  Error: Insert `··`  prettier/prettier
268:17  Error: Insert `··`  prettier/prettier
269:1  Error: Insert `··`  prettier/prettier

./components/ui/switch.tsx
40:19  Error: Replace `⏎············?·'bg-gray-900·dark:bg-gray-50'·⏎···········` with `?·'bg-gray-900·dark:bg-gray-50'`  prettier/prettier
63:19  Error: Insert `⏎`  prettier/prettier

./components/ui/tabs.tsx
32:1  Error: Delete `····`  prettier/prettier
38:13  Error: Replace `⏎··········ref={ref}⏎··········className={cn('w-full',·className)}⏎··········{...props}⏎········` with `·ref={ref}·className={cn('w-full',·className)}·{...props}`  prettier/prettier
165:53  Error: Insert `⏎`  prettier/prettier

./components/ui/textarea.tsx
4:18  Error: An interface declaring no members is equivalent to its supertype.  @typescript-eslint/no-empty-object-type
22:21  Error: Insert `⏎`  prettier/prettier

./components/ui/use-toast.tsx
9:6  Warning: 'ToastActionElement' is defined but never used.  @typescript-eslint/no-unused-vars
18:10  Warning: 'toasts' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./lib/auth.ts
5:43  Warning: 'request' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./lib/azureServices.ts
2:24  Warning: 'SearchIndexClient' is defined but never used.  @typescript-eslint/no-unused-vars
2:43  Warning: 'SearchResult' is defined but never used.  @typescript-eslint/no-unused-vars
142:19  Warning: 'data' is assigned a value but never used.  @typescript-eslint/no-unused-vars
216:54  Warning: 'documentType' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./lib/configManager.ts
13:10  Warning: 'withRetry' is defined but never used.  @typescript-eslint/no-unused-vars
13:36  Warning: 'ExternalServiceError' is defined but never used.  @typescript-eslint/no-unused-vars
886:5  Warning: 'endpoint' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
887:5  Warning: 'apiKey' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
888:5  Warning: 'config' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
909:5  Warning: 'endpoint' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
910:5  Warning: 'apiKey' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
932:5  Warning: 'endpoint' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
933:5  Warning: 'apiKey' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
934:5  Warning: 'config' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
957:5  Warning: 'apiKey' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
958:5  Warning: 'config' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./lib/env.ts
11:7  Warning: 'optionalEnvVars' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./lib/logger.ts
332:56  Error: Replace `·correlationIdProvider:·this.correlationIdProvider` with `⏎········correlationIdProvider:·this.correlationIdProvider,⏎·····`  prettier/prettier

./lib/queryOptimizer.ts
6:7  Warning: 'LONG_CACHE_TTL' is assigned a value but never used.  @typescript-eslint/no-unused-vars
373:1  Error: Delete `⏎⏎⏎`  prettier/prettier

./lib/security.ts
11:11  Warning: 'User' is defined but never used.  @typescript-eslint/no-unused-vars
251:51  Error: Insert `⏎·····`  prettier/prettier
252:1  Error: Delete `····`  prettier/prettier
276:57  Error: Insert `⏎·····`  prettier/prettier
277:1  Error: Delete `····`  prettier/prettier
295:57  Error: Insert `⏎·····`  prettier/prettier
296:1  Error: Delete `····`  prettier/prettier

./lib/serviceContainer.ts
515:19  Warning: '_uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars

./lib/validation.ts
224:14  Warning: 'e' is defined but never used.  @typescript-eslint/no-unused-vars

info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
techgirlnerd@TechGirlNerds-MacBook-Air esusauditai % 