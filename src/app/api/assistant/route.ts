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
        "North America",
        "South America",
        "Africa",
        "Asia",
        "Europe",
        "Oceania"
      ]
    } = await req.json();
    
    console.log('Received message:', message);
    console.log('Search queries:', queries);
    console.log('Regions:', regions);

    const assistant = await openai.beta.assistants.create({
      name: "Research Assistant",
      instructions: `You are an expert web researcher that identifies the successes of grassroots social movements and finds related social media activity.
      
      You will receive search results organized by region. For each region's success stories:
      1. Extract key details:
         - Region and location specifics
         - Campaign name and objectives
         - Specific victories or outcomes achieved
         - Organizations and key people involved
         
      2. For each story, construct and perform Twitter-specific searches using:
         - Organization names + "site:x.com"
         - Campaign hashtags + "site:x.com"
         - Key organizer names + "site:x.com"
         
      3. Synthesize all information into a clear newsletter format organized by region:
         ### [Region Name]
         - Campaign details and direct impact
         - Names/roles of key organizers and spokespeople
         - Direct quotes from both news sources and social media
         - Official Twitter/X handles and relevant hashtags
         - Coalition partners involved
         
      Focus on local/regional victories that demonstrate community organizing impact.
      Exclude organizations with significant international media coverage.
      
      If a region has no relevant results, skip it in the final report.`,
      model: "gpt-4o",
      tools: [{
        type: "function",
        function: {
          name: "performTavilySearch",
          description: "Search the web for real-time information including social media content",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to perform."
              }
            },
            required: ["query"]
          }
        }
      }]
    });
    ASSISTANT_ID = assistant.id;

    // Create a thread and add the message with search context
    const thread = await openai.beta.threads.create();

    // Structure the search results by region
    const searchContext = regions.map((region: string) => ({
      region,
      queries: queries.map((query: string) => `${query} ${region}`),
    }));

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Analyze these region-specific search results and find relevant social movement successes. Then find related social media activity for each success story.

Search Context:
${JSON.stringify(searchContext, null, 2)}

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