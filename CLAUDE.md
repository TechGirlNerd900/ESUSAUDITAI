
## DO NOT EDIT, FOLLOW THE GUIDE/PROMPT - CLAUDE DO NOT EDIT 

- When using Context, make sure that you keep the range of output in the range 2k to 8k based on what you think is the best.
- Maintain a file named library.md to stpre the Library IDs that you search for and before searching make sure that you check the file and use the library
ID already available. Otherwise, search for it.

## DO NOT EDIT, FOLLOW THE GUIDE/PROMPT - CLAUDE DO NOT EDIT 

Phase 1: Application Feature & Workflow Analysis (Highest Priority)
Objective: To analyze the described features and workflows, identify gaps or edge cases, and suggest enhancements to ensure the application is functionally complete and user-friendly.

Workflow Stress-Testing (Logical Audit):

Review the "Typical Audit Workflow" from Phase 1 to Phase 5. For each step, identify potential failure points or ambiguities.
Example Questions to Answer: What happens if a document upload is interrupted? Does the system have a resume capability? What if Azure Document Intelligence fails to process a file—is the user notified, and can they manually trigger a re-analysis? In Phase 4, what happens if an admin rejects a report? Does it go back to the auditor with notes?
Action: Create a list of edge cases and workflow gaps that need to be addressed in the application logic to make it more resilient.
Feature Enhancement & Deepening:

Analyze the core features and propose logical next steps to increase their value.
Ask Esus Assistant: Can the AI assistant save particularly useful Q&A pairs as "Key Findings" for the final report? Could it generate a summary of the entire chat history?
Smart Document Management: Does the version control show a visual diff between document versions? Could the application flag when two different documents appear to be near-duplicates?
Automated Report Generation: Can users create and save their own custom report templates? Can they select which "Red Flag" issues to include or exclude from a generated report?
Action: Propose a prioritized list of feature enhancements that would logically extend the application's current capabilities.
User Role & Permission Logic:

Critically evaluate the capabilities of each role (Admin, Auditor, Reviewer).
Example Questions: The description says a Reviewer has "limited interaction with Ask Esus." What does this mean? Can they only view chats, or can they ask a limited number of questions? The application's behavior should be clearly defined. Is there a workflow for an Auditor to request a review from a specific Reviewer?
Action: Document any ambiguities in the user roles and permissions that need to be clarified and implemented in the application logic.
Phase 2: Security Hardening & Compliance
Objective: To ensure the application's features are implemented securely.

Role-Based Access Control (RBAC) Validation:

Based on the defined user roles, systematically test that users cannot access functions or data outside their permissions. For example, confirm a Reviewer cannot trigger an API endpoint meant for an Auditor.
Comprehensive Security Audit:

Test for common vulnerabilities like XSS, CSRF (especially verifying the http-only cookie implementation), and Insecure Direct Object References (IDORs) within all relevant features.
Review the "Comprehensive Audit Trail" feature. What specific actions are logged? Ensure all critical events (logins, file uploads/deletions, report generation, role changes) are being logged to meet compliance requirements.
Phase 3: Data Integrity & Database Adaptation
Objective: To clean the current database for accurate testing and identify where the schema might need to be adjusted to support robust features.

Mock Data Removal:

Generate editable SQL scripts to identify and remove all test data (users, projects, files) from the database. This is to ensure that when you test the application's features, the results are not skewed by placeholder content.
Schema Adaptation Recommendations:

Based on your findings in Phase 1, identify where the current database schema may be insufficient to support the proposed feature enhancements or workflow improvements.
Example: "To support the feature of saving 'Key Findings' from the 'Ask Esus' chat, the database will likely need a new table, such as key_findings with columns for project_id, question, answer, and auditor_id."
Action: Provide a list of recommended database adjustments or new tables. The developer will then be responsible for implementing these changes.
Phase 4: Performance, Scalability & Final Checks
Objective: To ensure the application is performant and stable.

Performance & Load Testing:

Test the performance of key features under load, such as simultaneous document uploads and concurrent "Ask Esus" queries. Identify any performance bottlenecks in the application API.
Environment & Configuration Review:

Audit the technical stack for any hardcoded secrets or misconfigurations. Verify that error handling is comprehensive and that monitoring is correctly integrated with Application Insights.
Dependency Audit:

Scan all third-party libraries for known security vulnerabilities and suggest necessary updates.
Final Report:

Conclude with a comprehensive report that summarizes:

A list of actionable recommendations for improving application features and workflows.
A security audit report.
A set of SQL scripts for data cleaning and a list of recommended database changes to support new features.
A performance and stability analysis.


## DO NOT EDIT, FOLLOW THE GUIDE/PROMPT - CLAUDE DO NOT EDIT