ERRORS that broke app loading

fetchDocuments
app/dashboard/page.tsx (148:15)
async Dashboard.useEffect.fetchDashboardData
app/dashboard/page.tsx (91:9)



NO NAVIGATION OPTION to go back to dashboard from project to home page 
upload project ui element non funtiional 

settings page is non funtiional and never loads 
reports page should be empty or show funtions that reports featuure includes not an error Page Not Found

will appear very unappealing to new user with project
no option on the ui to send invite to auditor in  organisation or reviewer 

Application doesnt have a fixed side bar navigatiion that doesnt change when user navigates to different pages 
 
 App appears unprofessional and features are inaccesible from the front end 


there is no home page 

more prroblems to fix

const response = await fetch('/api/documents');
  147 |       if (!response.ok) {
> 148 |         throw new Error('Network response was not ok');
      |               ^
  149 |       }
  150 |       const data = await response.json();
  151 |       setDocuments(data.documents); // Assuming documents are in a 'documents' property


  why is app assuming there is a document for a new user and thorwing error instead of showing user how to upload document 

   const response = await fetch('/api/chat/general'); // Assuming this is the correct endpoint for general insights
  185 |       if (!response.ok) {
> 186 |         throw new Error('Network response was not ok');
      |               ^
  187 |       }
  188 |       const data = await response.json();
  189 |       // Assuming the API returns a single insight or an array of insights

   correct end point should be identified and fixed 

  > 165 |       const response = await fetch('/api/compliance/nigerian'); // Assuming this is the correct endpoint
  166 |       if (!response.ok) {
167 |         throw new Error('Network response was not ok');
      |               ^
  168 |       }
  169 |       const data = await response.json();
  170 |       setComplianceStatus(data.compliance); // Assuming compliance data is in a 'compliance' property


    what heppens when compliance data is not found // there should be proper erro shandling


   const response = await fetch('/api/auth/profile');
  112 |       if (!response.ok) {
> 113 |         throw new Error('Failed to fetch user profile');
      |               ^
  114 |       }
  115 |       const data = await response.json();
  116 |       setUserProfile(data.user); // Assuming the user object is nested under 'user'

why did user profile throw error and there should be better error handling and reporting 

Dashboard Error


 Dashboard shouldn't only contain project thats why app appears broken and disfunctional


 const response = await fetch('/api/projects');
  127 |       if (!response.ok) {
> 128 |         throw new Error('Network response was not ok');
      |               ^
  129 |       }
  130 |       const data = await response.json();
  131 |       setProjects(data.projects); // Assuming projects are in a 'projects' property



  why is app assuming there is a project for a new user and thorwing error instead of showing user how to create a project 

the dashbord should be like a home page not just an error display 

Navoagtion panel should be fixed and not change when user navigates to different pages 


see concole error logs 

✓ Starting...
✓ Ready in 2.4s
⚠ nodejs runtime support for middleware requires experimental.nodeMiddleware be enabled in your next.config
✓ Compiled /middleware in 399ms (223 modules)
○ Compiling /login ...
✓ Compiled /login in 2.1s (1085 modules)
GET /login?returnUrl=%2F&error=Auth+session+missing%21 200 in 2759ms
✓ Compiled in 657ms (417 modules)
⚠ Cross origin request detected from 192.168.18.4 to /_next/* resource. In a future major version of Next.js, you will need to explicitly configure "allowedDevOrigins" in next.config to allow this.
Read more: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
○ Compiling /favicon.ico ...
✓ Compiled /favicon.ico in 542ms (684 modules)
GET /favicon.ico 200 in 741ms
Middleware: Authenticated request to /dashboard by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
○ Compiling /dashboard ...
✓ Compiled /dashboard in 1866ms (2435 modules)
GET /dashboard 200 in 2842ms
○ Compiling /api/compliance/nigerian ...
✓ Compiled /api/compliance/nigerian in 1353ms (2587 modules)
GET /api/documents 404 in 1775ms
GET /api/documents 404 in 37ms
GET /api/auth/profile 401 in 2621ms
GET /api/chat/general 401 in 3123ms
GET /api/projects 401 in 3339ms
GET /api/auth/profile 401 in 812ms
GET /api/chat/general 401 in 827ms
GET /api/projects 401 in 812ms
GET /api/compliance/nigerian 401 in 6356ms
GET /api/compliance/nigerian 401 in 744ms
Middleware: Authenticated request to /projects by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
✓ Compiled /projects in 435ms (2606 modules)
GET /projects 200 in 538ms
GET /api/projects 401 in 776ms
GET /api/projects 401 in 752ms
GET /api/documents 404 in 194ms
GET /api/documents 404 in 41ms
GET /api/compliance/nigerian 401 in 1771ms
GET /api/projects 401 in 1791ms
GET /api/chat/general 401 in 1805ms
GET /api/compliance/nigerian 401 in 765ms
GET /api/chat/general 401 in 831ms
GET /api/projects 401 in 1161ms
GET /api/auth/profile 401 in 2991ms
Middleware: Authenticated request to /documents by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /documents 404 in 24ms
Middleware: Authenticated request to /documents by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /api/auth/profile 200 in 461ms
GET /documents 404 in 49ms
Middleware: Authenticated request to /dashboard by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /dashboard 200 in 713ms
GET /api/documents 404 in 177ms
GET /api/projects 401 in 939ms
GET /api/auth/profile 401 in 1410ms
Middleware: Authenticated request to /settings by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /api/chat/general 401 in 1677ms
GET /api/compliance/nigerian 401 in 1702ms
○ Compiling /settings ...
✓ Compiled /settings in 604ms (2621 modules)
GET /settings 200 in 707ms
GET /api/documents 404 in 320ms
GET /api/documents 404 in 51ms
GET /api/auth/profile 401 in 3225ms
GET /api/compliance/nigerian 401 in 3652ms
GET /api/chat/general 401 in 3659ms
GET /api/projects 401 in 4104ms
GET /api/auth/profile 401 in 880ms
GET /api/compliance/nigerian 401 in 695ms
GET /api/chat/general 401 in 745ms
Middleware: Authenticated request to /dashboard by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /api/projects 401 in 1453ms
GET /dashboard 200 in 2537ms
○ Compiling /favicon.ico ...
✓ Compiled /favicon.ico in 685ms (1538 modules)
GET /favicon.ico 200 in 1258ms
GET /api/documents 404 in 1058ms
GET /api/chat/general 401 in 1962ms
GET /api/compliance/nigerian 401 in 2681ms
GET /api/auth/profile 401 in 3340ms
GET /api/projects 401 in 3413ms
Middleware: Authenticated request to /dashboard by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /dashboard 200 in 789ms
GET /api/documents 404 in 145ms
GET /api/auth/profile 401 in 903ms
GET /api/compliance/nigerian 401 in 1267ms
GET /api/chat/general 401 in 1329ms
GET /api/projects 401 in 1332ms
Middleware: Authenticated request to /projects by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /projects 200 in 27ms
GET /api/projects 401 in 770ms
GET /api/projects 401 in 737ms
GET /api/documents 404 in 101ms
GET /api/documents 404 in 41ms
GET /api/compliance/nigerian 401 in 1458ms
GET /api/chat/general 401 in 1491ms
GET /api/projects 401 in 1557ms
GET /api/auth/profile 401 in 1597ms
GET /api/chat/general 401 in 615ms
GET /api/compliance/nigerian 401 in 685ms
GET /api/projects 401 in 757ms
GET /api/auth/profile 401 in 754ms
Middleware: Authenticated request to /settings by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /settings 200 in 29ms
GET /api/documents 404 in 87ms
GET /api/documents 404 in 40ms
GET /api/compliance/nigerian 401 in 1263ms
GET /api/chat/general 401 in 1264ms
GET /api/auth/profile 401 in 1421ms
GET /api/projects 401 in 1421ms
GET /api/compliance/nigerian 401 in 649ms
GET /api/chat/general 401 in 655ms
GET /api/auth/profile 401 in 655ms
GET /api/projects 401 in 745ms
Middleware: Authenticated request to /documents by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /documents 404 in 9ms
Middleware: Authenticated request to /documents by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /documents 404 in 49ms
Middleware: Authenticated request to /reports by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
✓ Compiled in 753ms (1099 modules)
Middleware: Authenticated request to /documents by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
Middleware: Authenticated request to /dashboard by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /documents 404 in 32ms
GET /dashboard 200 in 35ms
GET /favicon.ico 200 in 5ms
Middleware: Authenticated request to /documents by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /documents 404 in 43ms
Middleware: Authenticated request to /dashboard by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /dashboard 200 in 556ms
GET /favicon.ico 200 in 102ms
GET /api/documents 404 in 217ms
GET /api/compliance/nigerian 401 in 1129ms
GET /api/chat/general 401 in 1447ms
GET /api/auth/profile 401 in 1449ms
GET /api/projects 401 in 1681ms
Middleware: Authenticated request to /settings by user 63b258c5-7499-4c9f-9eeb-c7418fb27b18
GET /settings 200 in 12ms
GET /api/documents 404 in 77ms
GET /api/documents 404 in 47ms
GET /api/auth/profile 401 in 1526ms
GET /api/projects 401 in 1839ms
GET /api/chat/general 401 in 1847ms
GET /api/auth/profile 401 in 634ms
GET /api/chat/general 401 in 639ms
GET /api/compliance/nigerian 401 in 2540ms
GET /api/projects 401 in 738ms
GET /api/compliance/nigerian 401 in 745ms
