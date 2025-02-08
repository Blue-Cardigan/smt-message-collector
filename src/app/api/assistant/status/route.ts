import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { tavily } from "@tavily/core";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function performTavilySearch(query: string) {
  const response = await tvly.search(query, {
    max_results: 5, // Limiting results per search for conciseness
    time_range: "d",
  });
  return response;
}

async function handleToolCalls(threadId: string, runId: string, toolCalls: any[]) {
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

  await openai.beta.threads.runs.submitToolOutputs(
    threadId,
    runId,
    { tool_outputs: toolOutputs }
  );
}

export async function POST(req: Request) {
  try {
    const { threadId, runId } = await req.json();
    
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (runStatus.status === "requires_action") {
      const toolCalls = runStatus.required_action?.submit_tool_outputs.tool_calls;
      if (toolCalls) {
        await handleToolCalls(threadId, runId, toolCalls);
      }
      return NextResponse.json({ status: runStatus.status });
    }
    
    if (runStatus.status === "completed") {
      const messages = await openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      const messageContent = lastMessage.content[0];
      
      if ('text' in messageContent) {
        return NextResponse.json({ 
          status: "completed",
          response: messageContent.text.value 
        });
      }
    }
    
    return NextResponse.json({ status: runStatus.status });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
} 