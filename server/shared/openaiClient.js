const { OpenAI } = require('openai');

class OpenAIClient {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
            defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
            defaultHeaders: {
                'api-key': process.env.AZURE_OPENAI_API_KEY,
            }
        });
    }

    async analyzeDocument(extractedData, documentType = 'financial') {
        try {
            const prompt = this.buildAnalysisPrompt(extractedData, documentType);

            const response = await this.client.chat.completions.create({
                model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert financial auditor and AI assistant. Analyze the provided document data and provide insights, red flags, and highlights.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            });

            return this.parseAnalysisResponse(response.choices[0].message.content);
        } catch (error) {
            console.error('OpenAI analysis error:', error);
            throw new Error('Failed to analyze document with AI');
        }
    }

    async askEsus(question, context, projectData = null) {
        try {
            const contextPrompt = this.buildContextPrompt(context, projectData);

            const response = await this.client.chat.completions.create({
                model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
                messages: [
                    {
                        role: 'system',
                        content: 'You are Esus, an AI audit assistant. Answer questions about financial documents and audit findings based on the provided context. Be precise, professional, and highlight any compliance or risk issues.'
                    },
                    {
                        role: 'user',
                        content: `Context: ${contextPrompt}\n\nQuestion: ${question}`
                    }
                ],
                temperature: 0.2,
                max_tokens: 1500
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI chat error:', error);
            throw new Error('Failed to get response from Esus AI');
        }
    }

    buildAnalysisPrompt(extractedData, documentType) {
        return `
Analyze the following ${documentType} document data and provide:

1. A comprehensive summary (2-3 sentences)
2. Red flags or potential issues (list format)
3. Key highlights or positive findings (list format)
4. Confidence score (0-1)

Document Data:
${JSON.stringify(extractedData, null, 2)}

Please format your response as JSON with the following structure:
{
    "summary": "Your summary here",
    "redFlags": ["flag1", "flag2"],
    "highlights": ["highlight1", "highlight2"],
    "confidenceScore": 0.95
}
        `;
    }

    buildContextPrompt(context, projectData) {
        let prompt = 'Document Analysis Context:\n';

        if (context && context.length > 0) {
            context.forEach((doc, index) => {
                prompt += `\nDocument ${index + 1}:\n`;
                prompt += `- Summary: ${doc.summary || 'No summary available'}\n`;
                prompt += `- Red Flags: ${doc.redFlags ? doc.redFlags.join(', ') : 'None'}\n`;
                prompt += `- Highlights: ${doc.highlights ? doc.highlights.join(', ') : 'None'}\n`;
            });
        }

        if (projectData) {
            prompt += `\nProject Information:\n`;
            prompt += `- Client: ${projectData.client_name}\n`;
            prompt += `- Project: ${projectData.name}\n`;
            prompt += `- Status: ${projectData.status}\n`;
        }

        return prompt;
    }

    parseAnalysisResponse(response) {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(response);
            return {
                summary: parsed.summary || '',
                redFlags: parsed.redFlags || [],
                highlights: parsed.highlights || [],
                confidenceScore: parsed.confidenceScore || 0.8
            };
        } catch (error) {
            // Fallback to text parsing if JSON parsing fails
            return {
                summary: response.substring(0, 500),
                redFlags: [],
                highlights: [],
                confidenceScore: 0.7
            };
        }
    }

    async generateReportSummary(projectData, analysisResults) {
        try {
            const prompt = `
Generate a comprehensive audit report summary for the following project:

Project: ${projectData.name}
Client: ${projectData.client_name}
Status: ${projectData.status}

Analysis Results:
${JSON.stringify(analysisResults, null, 2)}

Please provide:
1. Executive Summary
2. Key Findings
3. Risk Assessment
4. Recommendations
5. Conclusion

Format as a professional audit report summary.
            `;

            const response = await this.client.chat.completions.create({
                model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a senior audit partner generating a professional audit report summary.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 3000
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Report generation error:', error);
            throw new Error('Failed to generate report summary');
        }
    }
}

module.exports = OpenAIClient;