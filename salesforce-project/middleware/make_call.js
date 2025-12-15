// make_call.js
require('dotenv').config({ path: '.env' }); // Or .env.configured if testing
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const to = process.env.TEST_PHONE_NUMBER;
const from = process.env.TWILIO_PHONE_NUMBER;
// You must replace this with your NGROK URL
const url = 'https://YOUR_NGROK_URL.ngrok-free.app/voice';

if (!to || !from) {
    console.error('Error: Please set TEST_PHONE_NUMBER and TWILIO_PHONE_NUMBER in .env');
    process.exit(1);
}

console.log(`Initiating call from ${from} to ${to}...`);

client.calls
    .create({
        url: url,
        to: to,
        from: from,
    })
    .then(call => console.log(`Call initiated. SID: ${call.sid}`))
    .catch(error => console.error('Error making call:', error));
