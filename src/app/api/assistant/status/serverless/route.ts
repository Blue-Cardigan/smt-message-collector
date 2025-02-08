import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { tavily } from "@tavily/core";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60;
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

async function performTavilySearch(query: string) {
  const response = await tvly.search(query, {
    max_results: 10,
    time_range: "day",
    // topic: "news"
    // search_depth: "advanced",
  });
  return response;
}

async function handleInitialSearch(queries: string[], region: string) {
  const regionQueries = queries.map((query: string) => `${region} ${query} -site:wikipedia.org`);
  const regionResults = await Promise.all(
    regionQueries.map(async (query: string) => {
          console.log(`Searching for: ${query}`);
          return performTavilySearch(query);
        })
      );
      return {
        region,
        results: regionResults
  };
}

async function handleToolCalls(threadId: string, runId: string, toolCalls: any[]) {
  const toolOutputs = [];

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === "performTavilySearch") {
      const query = JSON.parse(toolCall.function.arguments).query;
      console.log('Executing search query:', query);
      try {
        const searchResult = await performTavilySearch(query);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(searchResult)
        });
      } catch (error) {
        console.error('Search error:', error);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify({ error: "Search failed", results: [] })
        });
      }
    }
  }

  if (toolOutputs.length > 0) {
    await openai.beta.threads.runs.submitToolOutputs(
      threadId,
      runId,
      { tool_outputs: toolOutputs }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Handle initial search request
    if (body.type === 'initial_search') {
      const searchResults = await handleInitialSearch(body.queries, body.region);
      console.log('Search results:', searchResults.results[0]);
      return NextResponse.json(searchResults);
    }
    
    // Handle status check request
    const { threadId, runId } = body;
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (runStatus.status === "failed") {
      return NextResponse.json({ 
        status: "failed",
        error: runStatus.last_error?.message || "Run failed without specific error message"
      });
    }

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
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 