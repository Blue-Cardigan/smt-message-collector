import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { tavily } from "@tavily/core";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// Function to perform Tavily search
async function performTavilySearch(query: string) {
  const response = await tvly.search(query, {
    num_results: 3, // Limiting results per search for conciseness
  });
  return response;
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    console.log('Received message:', message);

    // Create an assistant with function calling capability
    const assistant = await openai.beta.assistants.create({
      name: "Research Assistant",
      instructions: `You are a helpful assistant that uses web search to provide comprehensive answers. 
      When asked a question, first generate up to 5 relevant search queries to gather information, 
      then synthesize the results into a well-structured response. Include relevant sources.`,
      model: "gpt-4",
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
    console.log('Created assistant:', assistant.id);

    // Create a thread
    const thread = await openai.beta.threads.create();
    console.log('Created thread:', thread.id);

    // Add a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });
    console.log('Added message to thread');

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });
    console.log('Started assistant run:', run.id);

    // Handle the run with function calling
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    while (runStatus.status !== "completed") {
      console.log('Current run status:', runStatus.status);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === "requires_action") {
        const toolCalls = runStatus.required_action?.submit_tool_outputs.tool_calls;
        console.log('Tool calls required:', toolCalls.length);

        const toolOutputs = [];

        for (const toolCall of toolCalls) {
          if (toolCall.function.name === "performTavilySearch") {
            const query = JSON.parse(toolCall.function.arguments).query;
            console.log('Executing search query:', query);
            const searchResult = await performTavilySearch(query);
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(searchResult),
            });
          }
        }

        // Submit tool outputs
        await openai.beta.threads.runs.submitToolOutputs(
          thread.id,
          run.id,
          { tool_outputs: toolOutputs }
        );
        console.log('Submitted tool outputs');
      }
      
      if (runStatus.status === "failed") {
        console.error('Run failed with status:', runStatus);
        throw new Error("Assistant run failed");
      }
    }

    console.log('Run completed successfully');

    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    return NextResponse.json({ 
      response: lastMessage.content[0].text.value 
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}