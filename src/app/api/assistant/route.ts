import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store assistant ID at module level
let ASSISTANT_ID: string;

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { 
      message, 
      queries = [
        "campaign victory justice",
      "campaign win protest",
      "government protest victory",
      "community organizing success",
      "Rights win protest",
      ],
      regions = [
        "Global"
      ]
    } = await req.json();
    
    console.log('Received message:', message);
    console.log('Search queries:', queries);
    console.log('Regions:', regions);

    // Forward search request to serverless endpoint
    const searchUrl = new URL('/api/assistant/status/serverless', req.url);
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        type: 'initial_search',
        queries,
        regions 
      }),
    });

    const searchResults = await searchResponse.json();

    const assistant = await openai.beta.assistants.create({
      name: "Research Assistant",
      instructions: `You are an expert web researcher that identifies the successes of grassroots social movements, searches for related social media activity, and provides a newsletter with the results.
      
      When you find a success story, ALWAYS use the performTavilySearch function to search for social media activity before including it in your report.
      
      You will receive search results organized by region. For each region's success stories:
      1. Extract key details:
         - Region and location specifics
         - Campaign name and objectives
         - Specific victories or outcomes achieved
         - Organizations and key people involved
         
      2. For each story, construct and perform Twitter-specific searches using "site:x.com" and your search function.
         
      3. Synthesize all information into a clear newsletter format organized by region:
         ### [Region Name]
         - Campaign details and direct impact
         - Names/roles of key organizers and spokespeople
         - Direct quotes from news sources and social media
         - Official Twitter/X handles and relevant hashtags if found
         - Coalition partners involved
         
      Focus on local/regional victories that demonstrate community organizing impact.
      Exclude organizations with significant international media coverage.
      
      If a region has no relevant results, skip it in the final report.`,
      model: "gpt-4o",
      tools: [{
        type: "function",
        function: {
          name: "performTavilySearch",
          description: "Search the web for Twitter/X activity on each story",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to perform. Use site:x.com for Twitter/X specific searches."
              }
            },
            required: ["query"]
          }
        }
      }]
    });
    ASSISTANT_ID = assistant.id;

    const thread = await openai.beta.threads.create();

    // Send the search results to the assistant
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Analyze these region-specific search results and find relevant social movement successes. Then find related social media activity for each success story.

Search Results:
${JSON.stringify(searchResults, null, 2)}

User question or context:
${message}

Organize your response by region, including only regions where relevant successes were found.`,
    });

    // Start the run
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    return NextResponse.json({ 
      threadId: thread.id,
      runId: run.id,
      status: run.status
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}