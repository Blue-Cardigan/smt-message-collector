import dotenv from 'dotenv';
import fetch from 'node-fetch';  // We need to import fetch for Node.js

dotenv.config();

const ASSISTANT_URL = 'http://localhost:3000/api/assistant';
const ASSISTANT_STATUS_URL = 'http://localhost:3000/api/assistant/status';

const config = {
    prompt: "Identify wins made by grassroots social justice organizations in countries around the world",
    queries: [
      "campaign victory justice",
      "campaign win protest",
      "government protest victory",
      "community organizing success",
      "Rights win protest",
    ],
    regions: [
        // "North America",
        // "South America",
        // "Africa",
        "Asia",
        // "Europe",
        // "Oceania"
    ],
    pollInterval: 10, // seconds to wait between polls
    maxAttempts: 30 // maximum number of attempts
};

// Initial request to start the process
async function makeInitialRequest(message, queries, regions) {
    const response = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            message,
            queries,
            regions
        })
    });
    return await response.json();
}

// Poll for results
async function pollStatus(threadId, runId) {
    const response = await fetch(ASSISTANT_STATUS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threadId, runId })
    });
    
    // Log the raw response for debugging
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    try {
        // Only try to parse if we have content
        if (responseText) {
            return JSON.parse(responseText);
        }
        return { status: "in_progress" };
    } catch (error) {
        console.error('Parse error for response:', responseText);
        return { status: "in_progress", error: error.message };
    }
}

// Sleep function using promises instead of busy waiting
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function main() {
    const { prompt, queries, regions } = config;
    console.log('Starting with:');
    console.log('Prompt:', prompt);
    console.log('Queries:', queries);
    console.log('Regions:', regions);
    
    // Make initial request
    console.log('\nMaking initial request...');
    const initialResponse = await makeInitialRequest(prompt, queries, regions);
    console.log('Initial response:', initialResponse);
    
    // Poll until complete
    let complete = false;
    let finalResponse = null;
    let attempts = 0;
    
    while (!complete && attempts < config.maxAttempts) {
        attempts++;
        console.log(`\nPoll attempt ${attempts}/${config.maxAttempts}`);
        
        const statusResponse = await pollStatus(initialResponse.threadId, initialResponse.runId);
        
        if (statusResponse.status === 'completed') {
            complete = true;
            finalResponse = statusResponse.response;
            console.log('\nFinal response:', finalResponse);
        } else if (statusResponse.error) {
            throw new Error(statusResponse.error);
        } else {
            console.log(`Status: ${statusResponse.status}`);
            console.log(`Waiting for ${config.pollInterval} seconds...`);
            await sleep(config.pollInterval);
        }
    }
    
    if (!complete) {
        throw new Error(`Request timed out after ${config.maxAttempts} attempts`);
    }
    
    return finalResponse;
}

// Run the script
main()
    .then(response => {
        console.log('\nScript completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nScript failed:', error);
        process.exit(1);
    });