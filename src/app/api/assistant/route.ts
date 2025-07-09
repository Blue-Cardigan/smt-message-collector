import { GoogleGenerativeAI, GenerateContentResponse } from "@google/generative-ai";
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const instructions = `You are an expert web researcher that identifies the successes of grassroots social movements for a specific region and provides a newsletter with the results. 

These results can be from social media posts (Twitter, Bluesky), blog pages on organizations' websites, news articles, or other sources.

Your responses are grounded in real-time web content using your search capabilities. For every claim, story, or data point you present, you MUST use information from the search results.

A success story is a grassroots social movement victory such as a campaign win, protest victory, or other social movement victory.

For each success story you find for the given region:
1.  Extract key details:
    *   Region and location specifics
    *   Campaign name and objectives
    *   Specific victories or outcomes achieved
    *   Organizations and key people involved
    *   Any other relevant details

2.  Synthesize all information into a clear newsletter format. The output should be structured with markdown.

    ### [Region Name]
    *   **Campaign:** [Campaign Name]
        *   **Details:** Campaign details and direct impact.
        *   **Organizers:** Names/roles of key organizers and spokespeople.
        *   **Quotes:** Direct quotes from news sources and social media.
        *   **Partners:** Coalition partners involved.
        *   **Socials:** Official social media handles and relevant hashtags if found.

#### Instructions
*   Focus on local/regional victories that demonstrate community organizing impact.
*   Be concise and to the point. Your response should be easy to skim.
*   Only include found information in your response. If information is not found for a specific point (e.g., "Partners"), omit that line.
*   Do not make any claims that are not supported by the search results.
*   Do not include a summary section at the end.
*   Aim to find at least one relevant story for the region.
*   In the rare case that there are no relevant results for the region, your response should be \`### [region name]
No relevant results found.\`.
      `;

interface GroundingSupport {
  segment?: {
    endIndex?: number;
  };
  groundingChunkIndices?: number[];
}

interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GroundingMetadata {
  groundingSupports: GroundingSupport[];
  groundingChunks: GroundingChunk[];
}

function addCitationsToText(response: GenerateContentResponse & { text: () => string }): string {
    let text = response.text();
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
        return text;
    }
    const metadata = (candidates[0] as any).groundingMetadata as GroundingMetadata | undefined;

    if (!metadata) {
        console.log("No grounding metadata found in candidates.");
        return text;
    }

    const { groundingSupports: supports, groundingChunks: chunks } = metadata;

    if (!supports || !chunks) {
        return text;
    }

    const citations: { uri: string; title: string; index: number }[] = [];
    const chunkMap = new Map<string, number>();

    chunks.forEach((chunk) => {
        if (chunk.web?.uri) {
            if (!chunkMap.has(chunk.web.uri)) {
                const index = citations.length + 1;
                chunkMap.set(chunk.web.uri, index);
                citations.push({
                    uri: chunk.web.uri,
                    title: chunk.web.title || chunk.web.uri,
                    index: index,
                });
            }
        }
    });

    const sortedSupports = [...supports].sort(
        (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
    );

    for (const support of sortedSupports) {
        const endIndex = support.segment?.endIndex;
        if (endIndex === undefined || !support.groundingChunkIndices || support.groundingChunkIndices.length === 0) {
            continue;
        }

        const citationIndices = [
            ...new Set(
                support.groundingChunkIndices
                    .map((i: number) => {
                        const chunk = chunks[i];
                        return chunk?.web?.uri ? chunkMap.get(chunk.web.uri) : null;
                    })
                    .filter((n): n is number => n !== null)
            ),
        ];

        if (citationIndices.length > 0) {
            const citationString = ` [${citationIndices.sort((a, b) => a - b).join('][')}]`;
            text = text.slice(0, endIndex) + citationString + text.slice(endIndex);
        }
    }

    if (citations.length > 0) {
        text += '\n\n**Sources:**\n';
        citations.forEach(citation => {
            text += `\n[${citation.index}] [${citation.title}](${citation.uri})`;
        });
    }

    return text;
}


// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const smtApiKey = process.env.SMT_API_KEY;

// Configure the generative model
const generationConfig = {
  temperature: 1.0, // Set to 1.0 for ideal grounding results
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,
};

// Define the grounding tool using Google Search
// Note: The API key for Google Search is not explicitly passed here;
// it's typically handled by the SDK's environment configuration or underlying auth.
const tools = [{ googleSearch: {} }] as any;

// Note: Grounding requires specific model versions, e.g., 'gemini-1.5-pro-latest' or 'gemini-1.5-flash-latest'
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash-latest", // Ensure this model supports grounding
  // safetySettings removed as per request
  generationConfig,
  tools,
  systemInstruction: instructions, 
});

export async function POST(req: Request) {
  try {
    const { 
      message, 
      region,
      // queries are no longer needed as grounding handles search
      apiKey 
    } = await req.json();
    
    // Validate API key
    if (apiKey !== smtApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Received message:', message);
    console.log('Region:', region);

    // Get current date and format it
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;

    // Construct the prompt for Gemini, including the region and user message.
    // Grounding will automatically use the content to perform relevant searches.
    const prompt = `Current Date: ${currentDate}
Region: ${region}
User query: ${message}

Please research and report on grassroots social movement successes in the specified region, focusing on information from the Current Date (${currentDate}) and the previous day, and following the instructions provided.`;

    console.log('Sending prompt to Gemini:', prompt);

    // Generate content using the model with grounding
    const result = await model.generateContent(prompt);

    const response = result.response;
    
    const textWithCitations = addCitationsToText(response);

    console.log('Gemini Response with Citations:', textWithCitations);

    return NextResponse.json({ 
      status: "completed", // Directly return completed status
      response: textWithCitations 
    });

  } catch (error: any) {
    console.error('Error processing request:', error);
    // Check if the error is related to grounding (e.g., citations not available)
    if (error.message && error.message.includes('grounding')) {
       return NextResponse.json(
        { error: `Grounding failed: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Failed to process request: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}