// agentforce.js
const axios = require('axios');

class AgentforceClient {
    constructor(config) {
        this.baseUrl = config.instanceUrl;
        this.accessToken = config.accessToken;
        this.agentId = config.agentId;
        this.sessionId = null; // Initialize sessionId
    }

    async sendMessage(text, sessionId) {
        if (!this.agentId || !this.accessToken) {
            return this.mockResponse(text);
        }

        try {
            // 1. Create Session if needed
            if (!this.sessionId) {
                console.log('[Agentforce] Creating new session...');
                const sessionUrl = `${this.baseUrl}/einstein/ai-agent/v1/agents/${this.agentId}/sessions`;
                const sessionRes = await axios.post(
                    sessionUrl,
                    { externalSessionKey: `voice-${Date.now()}` },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                this.sessionId = sessionRes.data.sessionId;
                console.log(`[Agentforce] Session created: ${this.sessionId}`);
            }

            // 2. Send Message
            console.log(`[Agentforce] Sending: "${text}"`);
            const messageUrl = `${this.baseUrl}/einstein/ai-agent/v1/agents/${this.agentId}/sessions/${this.sessionId}/messages`;

            const response = await axios.post(
                messageUrl,
                {
                    message: {
                        sequenceId: Date.now(),
                        type: 'text',
                        text: text
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // 3. Extract Response
            // Note: Response structure depends on the Agent's output. 
            // Assuming standard text response for now.
            const messages = response.data.messages;
            const lastMessage = messages[messages.length - 1];
            const responseText = lastMessage.text || "I processed that, but have no response.";

            console.log(`[Agentforce] Received: "${responseText}"`);
            return responseText;

        } catch (error) {
            console.error('[Agentforce] API Error:', error.response ? error.response.data : error.message);
            console.log('[Agentforce] Falling back to mock...');
            return this.mockResponse(text);
        }
    }

    mockResponse(text) {
        console.log(`[Agentforce] Mocking response for: "${text}"`);
        // Simulate network delay
        return new Promise(resolve => {
            setTimeout(() => {
                let responseText = "I'm sorry, I didn't understand that.";
                if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
                    responseText = "Hi Prateek, I'm calling from Acme Corp about your renewal for the GenWatt Diesel 1000kW. Do you have a minute?";
                } else if (text.toLowerCase().includes('cost') || text.toLowerCase().includes('price')) {
                    responseText = "Last time you paid $10,000. Would you like to renew at the same rate?";
                } else if (text.toLowerCase().includes('yes') || text.toLowerCase().includes('renew')) {
                    responseText = "Great! I've updated your contract. Have a wonderful day!";
                }
                resolve(responseText);
            }, 1000);
        });
    }
}

module.exports = AgentforceClient;
