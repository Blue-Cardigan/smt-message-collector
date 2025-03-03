# SMT Message Collector

A Next.js application that uses OpenAI's Assistant API and Tavily search to collect and analyze social movement success stories from around the world.

## Project Overview

This application:
1. Takes user input about regions to search (Airtable script, or interface when testing)
2. Uses Tavily search API to find information about social movement successes in those regions
3. Processes the search results using OpenAI's Assistant API
4. Formats the information into a newsletter-style report that includes:
   - Campaign details and impact
   - Key organizers and spokespeople
   - Quotes from news sources and social media
   - Links to relevant sources
   - Twitter/X handles and hashtags

## For Social Movement Technologies Staff

This application is designed with the following architecture considerations:

### AirTable Integration
- The application is designed to be called from an AirTable script on a loop
- Each call to the API specifies a single region to process
- Results can be collected and stored back in AirTable

### Timeout Handling
- Vercel (our hosting platform) has a 30-second timeout limit for API endpoints
- To work around this limitation, the application:
  - Processes one region at a time
  - Uses a polling mechanism to check status without timing out
  - Returns results incrementally

### Serverless Architecture
- Web searches (via Tavily) and OpenAI API calls require a serverless architecture
- The serverless functions have shorter timeout limits than regular endpoints
- The application uses a multi-stage approach:
  1. Initial request starts the process
  2. Status polling checks progress
  3. Final response is returned when processing completes

## Prerequisites

- Node.js (v18 or newer)
- npm or yarn
- OpenAI API key
- Tavily API key

## Environment Setup

1. Clone this repository
2. Create a `.env` file in the root directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   TAVILY_API_KEY=your_tavily_api_key
   SMT_API_KEY=until-all-are-free
   ```

## Installation

```bash
# Install dependencies
npm install
# or
yarn install
```

## Running the Application

### Development Mode (Testing Interface)

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

The web interface provides a user-friendly way to test the API with the following features:

- **Form Section**:
  - Message/Prompt: The main instruction for the assistant
  - Region Selection: Choose which region to search for social movement successes
  - Search Queries: Customize the search terms (one per line)
  - API Key: Authentication for the API

- **Process Status Section**:
  - Visual progress indicator showing the current step
  - Real-time status updates
  - Error messages if something goes wrong
  - Formatted results with proper styling for headers, bullet points, and links

This interface is primarily for testing and development purposes. For production use, the API should be called directly from AirTable scripts.

### Testing the Assistant

You can test the assistant functionality using the provided test script:

```bash
node test-assistant.js
```

This script will:
1. Send a request to the assistant API with predefined queries and regions
2. Poll for results until completion
3. Display the final responses

You can configure the test parameters by editing the `config` object in `test-assistant.js`.

## Key Files and Directories

### Frontend (Testing Interface)

- `src/app/page.tsx`: Main page component with the user interface for testing
  - Includes form for all required parameters
  - Shows visual progress indicators
  - Formats and displays the results
- `src/app/layout.tsx`: Root layout component
- `src/app/globals.css`: Global styles

### Backend API Routes

- `src/app/api/assistant/route.ts`: Main assistant API endpoint that creates an OpenAI assistant and starts a thread
- `src/app/api/assistant/status/route.ts`: API endpoint for checking the status of an assistant run
- `src/app/api/assistant/status/serverless/route.ts`: Serverless function that handles search requests and tool calls

### Configuration Files

- `package.json`: Project dependencies and scripts
- `next.config.ts`: Next.js configuration
- `tailwind.config.ts`: Tailwind CSS configuration
- `tsconfig.json`: TypeScript configuration

## How It Works

1. An AirTable script (or the testing interface) sends a request with the prompt, region, and search queries
2. The message is sent to the assistant API endpoint
3. The API creates an OpenAI assistant with specific instructions
4. The assistant processes the message and search results
5. If needed, the assistant uses the Tavily search API to find additional information
6. The client polls the status API until the assistant completes its task
7. The final response is displayed to the user (or stored in AirTable for subsequent email)

## Technical Architecture Details

### Request Flow

```
AirTable Script → API Endpoint → OpenAI Assistant → Tavily Search → Status Polling → Final Response
```

### Timeout Handling

1. **Initial Request**: The first API call starts the process but returns quickly with IDs
2. **Serverless Processing**: Long-running tasks happen in serverless functions
3. **Status Polling**: Periodic checks on progress without hitting timeouts
4. **Completion**: Final results are returned when processing is done

This architecture ensures that:
- No single request exceeds Vercel's 30-second timeout
- Long-running AI and search operations can complete
- Results are reliably delivered back to the caller

## API Endpoints

### POST /api/assistant
Initiates a new search request.

**Request Body:**
```json
{
  "message": "Identify wins made by grassroots social justice organizations",
  "region": "Africa",
  "queries": [
    "protest success activists",
    "social movement campaign win activist",
    "government protest victory activism"
  ],
  "apiKey": "until-all-are-free"
}
```

**Response:**
```json
{
  "threadId": "thread_abc123",
  "runId": "run_xyz789",
  "status": "queued"
}
```

### POST /api/assistant/status
Checks the status of a running request.

**Request Body:**
```json
{
  "threadId": "thread_abc123",
  "runId": "run_xyz789"
}
```

**Response (in progress):**
```json
{
  "status": "in_progress"
}
```

**Response (completed):**
```json
{
  "status": "completed",
  "response": "### Africa\n- Campaign details and direct impact..."
}
```

## Customization

You can customize the assistant's behavior by modifying:
- The search queries in `test-assistant.js`
- The assistant instructions in `src/app/api/assistant/instructions.md`
- The regions to search in `test-assistant.js`

## Deployment

This application can be deployed on Vercel or any other platform that supports Next.js applications.

```bash
npm run build
npm run start
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
