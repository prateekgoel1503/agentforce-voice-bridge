// server.js
require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const AgentforceClient = require('./agentforce');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Handle HTTP POST for Twilio Voice Webhook
app.post('/voice', (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(`
    <Response>
      <Connect>
        <Stream url="wss://${req.headers.host}/stream" />
      </Connect>
    </Response>
  `);
});

// Handle WebSocket Connection
wss.on('connection', (ws) => {
    console.log('Twilio Media Stream Connected');

    let deepgramLive = null;

    // Setup Deepgram Live Client
    const setupDeepgram = () => {
        deepgramLive = deepgram.listen.live({
            model: 'nova-2',
            language: 'en-US',
            smart_format: true,
            encoding: 'mulaw',
            sample_rate: 8000,
            channels: 1,
        });

        deepgramLive.on(LiveTranscriptionEvents.Open, () => {
            console.log('Deepgram STT Connected');
        });



        deepgramLive.on(LiveTranscriptionEvents.Error, (err) => {
            console.error('Deepgram Error:', err);
        });
    };

    setupDeepgram();

    const agentforce = new AgentforceClient({
        instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
        accessToken: process.env.SALESFORCE_ACCESS_TOKEN,
        agentId: process.env.AGENTFORCE_AGENT_ID
    });

    ws.on('message', (message) => {
        const msg = JSON.parse(message);
        switch (msg.event) {
            case 'connected':
                console.log('Twilio Connected Event');
                break;
            case 'start':
                console.log('Twilio Start Event');
                streamSid = msg.start.streamSid;
                break;
            case 'media':
                if (deepgramLive && deepgramLive.getReadyState() === 1) {
                    const audio = Buffer.from(msg.media.payload, 'base64');
                    deepgramLive.send(audio);
                }
                break;
            case 'stop':
                console.log('Twilio Stop Event');
                if (deepgramLive) deepgramLive.finish();
                break;
        }
    });

    // Handle Deepgram Transcripts
    deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript && data.is_final && transcript.trim().length > 0) {
            console.log('User said:', transcript);

            // 1. Send to Agentforce
            const agentResponse = await agentforce.sendMessage(transcript);

            // 2. Convert to Audio (TTS)
            try {
                const response = await deepgram.speak.request(
                    { text: agentResponse },
                    {
                        model: 'aura-asteria-en',
                        encoding: 'mulaw',
                        sample_rate: 8000,
                        container: 'none',
                    }
                );

                const stream = await response.getStream();
                const reader = stream.getReader();

                // 3. Stream Audio back to Twilio
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const payload = Buffer.from(value).toString('base64');
                    const mediaMessage = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload },
                    };
                    ws.send(JSON.stringify(mediaMessage));
                }

                // Mark as done (optional for bidirectional)
                // ws.send(JSON.stringify({ event: 'mark', streamSid: streamSid, mark: { name: 'response_complete' } }));

            } catch (err) {
                console.error('TTS Error:', err);
            }
        }
    });

    ws.on('close', () => {
        console.log('Twilio Media Stream Closed');
        if (deepgramLive) deepgramLive.finish();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
