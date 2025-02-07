import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { tavily } from "@tavily/core";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    console.log('Received message:', message);

    // Create an assistant
    const assistant = await openai.beta.assistants.create({
      name: "Research Assistant",
      instructions: `You are a helpful assistant that uses web search to provide comprehensive answers. 
      When asked a question, first generate up to 5 relevant search queries to gather information, 
      then synthesize the results into a well-structured response. Include relevant sources. The current date is ${new Date().toISOString().split('T')[0]}.`,
      model: "gpt-4o",
      tools: [{
        type: "function",
        function: {
          name: "performTavilySearch",
          description: "Search the web for real-time information",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to perform"
              }
            },
            required: ["query"]
          }
        }
      }]
    });

    // Create a thread and add the message
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // Start the run
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
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