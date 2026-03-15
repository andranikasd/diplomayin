const llmWrapper = require('./llm-wrapper');

/**
 * Response Generator
 * Converts SQL results into natural language responses
 */
class ResponseGenerator {
    async generateResponse(userQuestion, sqlResults, visualization) {
        try {
            if (!process.env.ENABLE_AI_SQL || process.env.ENABLE_AI_SQL !== 'true') {
                // Fallback: simple text response
                return this.generateSimpleResponse(userQuestion, sqlResults, visualization);
            }

            // Use AI to generate natural, conversational response
            const prompt = this.buildResponsePrompt(userQuestion, sqlResults, visualization);

            const response = await llmWrapper.chat([
                { role: 'system', content: 'You are a helpful analytics assistant for Armenian OSINT data. Provide clear, concise answers based on the data provided. Be conversational and natural.' },
                { role: 'user', content: prompt }
            ], {
                temperature: 0.7,
                maxTokens: 500
            });

            return {
                text: response.content.trim(),
                hasChart: visualization?.suggestChart || false,
                chartConfig: visualization
            };
        } catch (error) {
            console.error('Error generating response:', error);
            return this.generateSimpleResponse(userQuestion, sqlResults, visualization);
        }
    }

    buildResponsePrompt(userQuestion, results, visualization) {
        const resultCount = results.length;
        const hasData = resultCount > 0;

        if (!hasData) {
            return `The user asked: "${userQuestion}"\n\nNo data was found. Provide a brief, friendly response explaining that no data is available for this query.`;
        }

        // Build data summary
        const dataSummary = this.summarizeResults(results);

        let prompt = `The user asked: "${userQuestion}"\n\nHere is the data:\n${dataSummary}\n\n`;

        if (visualization?.suggestChart) {
            prompt += `Note: This data is suitable for a ${visualization.chartType} chart.\n\n`;
        }

        prompt += `Please provide a natural, conversational response that:
1. Directly answers the question
2. Mentions key insights from the data
3. Is friendly and professional
4. Keeps it concise (2-3 sentences)
5. Uses "In Armenia" or similar context when appropriate

Do NOT mention SQL, databases, or technical details. Just answer naturally.`;

        return prompt;
    }

    summarizeResults(results, maxRows = 10) {
        if (!results || results.length === 0) {
            return 'No results';
        }

        const columns = Object.keys(results[0]);
        const rows = results.slice(0, maxRows);

        let summary = `Found ${results.length} result(s):\n\n`;

        rows.forEach((row, index) => {
            const values = columns.map(col => `${col}: ${row[col]}`).join(', ');
            summary += `${index + 1}. ${values}\n`;
        });

        if (results.length > maxRows) {
            summary += `\n... and ${results.length - maxRows} more`;
        }

        return summary;
    }

    generateSimpleResponse(userQuestion, results, visualization) {
        if (!results || results.length === 0) {
            return {
                text: "I couldn't find any data matching your query.",
                hasChart: false,
                chartConfig: null
            };
        }

        const count = results.length;
        let text = `Found ${count} result${count > 1 ? 's' : ''} for your query.`;

        if (visualization?.suggestChart) {
            text += ` A ${visualization.chartType} chart has been generated below.`;
        }

        return {
            text,
            hasChart: visualization?.suggestChart || false,
            chartConfig: visualization
        };
    }
}

module.exports = new ResponseGenerator();
