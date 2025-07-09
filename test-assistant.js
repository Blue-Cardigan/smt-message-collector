import dotenv from 'dotenv';
import fetch from 'node-fetch';  // We need to import fetch for Node.js

dotenv.config();

const ASSISTANT_URL = 'http://localhost:3001/api/assistant';

const config = {
    prompt: "Identify wins made by grassroots social justice organizations in countries around the world",
    queries: [
        "protest success activists",
        "social movement campaign win activist",
        "government protest victory activism",
    ],
    regions: [
        // "North America",
        // "South America",
        "Africa",
        "Asia",
        // "Europe",
        // "Australia"
    ],
};

// Initial request to start the process
async function makeInitialRequest(message, queries, region) {
    const response = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            message,
            queries,
            region: region,
            apiKey: process.env.SMT_API_KEY
        })
    });
    const responseText = await response.text();
    console.log("Raw response text:", responseText);
    return JSON.parse(responseText);
}

async function main() {
    const { prompt, queries, regions } = config;
    console.log('Starting with:');
    console.log('Prompt:', prompt);
    console.log('Queries:', queries);
    console.log('Regions:', regions);
    
    let allResponses = [];
    
    // Process each region separately
    for (const region of regions) {
        console.log(`\nProcessing region: ${region}`);
        
        // Make initial request for this region
        console.log('Making initial request...');
        const response = await makeInitialRequest(prompt, queries, region);
        
        if (response.status === 'completed') {
            console.log('\nFinal response:', response.response);
            allResponses.push({ region, response: response.response });
        } else {
            throw new Error(`Request for region ${region} failed: ${response.error || 'Unknown error'}`);
        }
    }
    
    return allResponses;
}

// Run the script
main()
    .then(response => {
        console.log('\nScript completed successfully');
        console.log('\nFull responses:');
        console.log(JSON.stringify(response, null, 2));
        process.exit(0);
    })
    .catch(error => {
        console.error('\nScript failed:', error);
        process.exit(1);
    });