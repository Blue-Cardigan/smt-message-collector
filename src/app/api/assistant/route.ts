import { GoogleGenerativeAI, GenerateContentResponse } from "@google/generative-ai";
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Read instructions from the markdown file
const instructionsPath = path.join(process.cwd(), 'src/app/api/assistant/instructions.md');
const instructions = fs.readFileSync(instructionsPath, 'utf-8');

interface GroundingSupport {
  segment?: {
    endIndex?: number;
  };
  groundingChunkIndices?: number[];
}

interface GroundingChunk {
  web?: {
    uri?: string;
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

    if (metadata) {
        console.log("Found grounding metadata:", JSON.stringify(metadata, null, 2));
    } else {
        console.log("No grounding metadata found in candidates.");
        return text;
    }

    const { groundingSupports: supports, groundingChunks: chunks } = metadata;

    if (!supports || !chunks) {
        return text;
    }

    const sortedSupports = [...supports].sort(
        (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
    );

    for (const support of sortedSupports) {
        const endIndex = support.segment?.endIndex;
        if (endIndex === undefined || !support.groundingChunkIndices || support.groundingChunkIndices.length === 0) {
            continue;
        }

        const citationLinks = support.groundingChunkIndices
            .map((i: number) => {
                const chunk = chunks[i];
                if (chunk && chunk.web && chunk.web.uri) {
                    return `[${i + 1}](${chunk.web.uri})`;
                }
                return null;
            })
            .filter(Boolean);

        if (citationLinks.length > 0) {
            const citationString = ` ${citationLinks.join(' ')}`;
            text = text.slice(0, endIndex) + citationString + text.slice(endIndex);
        }
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
const tools = [{ googleSearch: {} }] as any; // Cast to any to bypass strict type check

// Note: Grounding requires specific model versions, e.g., 'gemini-1.5-pro-latest' or 'gemini-1.5-flash-latest'
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", // Ensure this model supports grounding
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