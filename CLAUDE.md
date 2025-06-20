### Context7 Integration Rules
- When using Context7, keep output range between 2k-4k tokens based on optimal context
- Maintain `library.md` file to store Library IDs - check this file before searching for new library IDs
- Use existing library IDs when available

### Zero Hallucination Policy
- **NO GUESSING**: Use high reasoning skills
- If uncertainty arises, first consult MCP Context7 for up-to-date documentation, schemas, rules, and specifications
- Only escalate to user if Context7 cannot resolve ambiguity and proceeding would risk code safety or system stability
- **ZERO HALLUCINATION**: Do not invent functionality, fields, parameters, APIs, or behaviors
- For AI-generated logic (RAG, report generation, summarization), implement strict guardrail prompts
- When context is insufficient, AI logic must return: "I cannot answer this question based on the provided documents"
