const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
require('dotenv').config();

class LLMWrapper {
    constructor() {
        this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
        this.providers = {};

        // Initialize OpenAI if API key is present
        if (process.env.OPENAI_API_KEY) {
            this.providers.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }

        // Initialize Anthropic if API key is present
        if (process.env.ANTHROPIC_API_KEY) {
            this.providers.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
        }

        // Initialize Ollama if base URL is present
        if (process.env.OLLAMA_BASE_URL) {
            this.providers.ollama = {
                baseURL: process.env.OLLAMA_BASE_URL
            };
        }
    }

    async chat(messages, options = {}) {
        const provider = options.provider || this.defaultProvider;
        const temperature = options.temperature || 0.1;
        const maxTokens = options.maxTokens || 2000;

        try {
            switch (provider) {
                case 'openai':
                    return await this.chatOpenAI(messages, { temperature, maxTokens });

                case 'anthropic':
                    return await this.chatAnthropic(messages, { temperature, maxTokens });

                case 'ollama':
                    return await this.chatOllama(messages, { temperature, maxTokens });

                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }
        } catch (error) {
            console.error(`Error with ${provider}:`, error.message);

            // Try fallback to another provider if available
            if (options.allowFallback !== false) {
                const fallbackProvider = this.getFallbackProvider(provider);
                if (fallbackProvider) {
                    console.log(`Falling back to ${fallbackProvider}...`);
                    return await this.chat(messages, { ...options, provider: fallbackProvider, allowFallback: false });
                }
            }

            throw error;
        }
    }

    async chatOpenAI(messages, options) {
        if (!this.providers.openai) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await this.providers.openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens
        });

        return {
            content: response.choices[0].message.content,
            provider: 'openai',
            model: response.model,
            usage: response.usage
        };
    }

    async chatAnthropic(messages, options) {
        if (!this.providers.anthropic) {
            throw new Error('Anthropic API key not configured');
        }

        // Convert messages format for Anthropic
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const response = await this.providers.anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            system: systemMessage?.content || undefined,
            messages: conversationMessages
        });

        return {
            content: response.content[0].text,
            provider: 'anthropic',
            model: response.model,
            usage: response.usage
        };
    }

    async chatOllama(messages, options) {
        if (!this.providers.ollama) {
            throw new Error('Ollama base URL not configured');
        }

        const response = await axios.post(`${this.providers.ollama.baseURL}/api/chat`, {
            model: 'llama2',
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature
            }
        });

        return {
            content: response.data.message.content,
            provider: 'ollama',
            model: response.data.model,
            usage: null
        };
    }

    getFallbackProvider(currentProvider) {
        const availableProviders = Object.keys(this.providers).filter(p => p !== currentProvider);
        return availableProviders[0] || null;
    }

    getAvailableProviders() {
        return Object.keys(this.providers);
    }
}

module.exports = new LLMWrapper();
