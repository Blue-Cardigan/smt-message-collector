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
    const { message } = await req.json();
    console.log('Received message:', message);

    // Create or retrieve assistant
    // if (!ASSISTANT_ID) {
      const assistant = await openai.beta.assistants.create({
        name: "Research Assistant",
        instructions: `You are an expert web researcher that identifies the successes of grassroots social movements. You have access to a web search which returns up to 5 results.
        When asked a question:
        1. Generate 5 search queries to uncover relevant grassroots social movement wins
        2. Create a search for each win by including "twitter"
        3. Synthesize the web results and related Twitter links for a clear and informative internal newsletter
        4. The newsletter should contain each organization's name, the win, the most relevant web links, and tweets
        5. Don't include references to time or date in your query, as the web search will return the most recent results`,
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
    // }

    // Create a thread and add the message
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
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