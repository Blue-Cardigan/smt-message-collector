'use client';

import { useState, useEffect } from 'react';

// Default search queries
const DEFAULT_QUERIES = [
  "protest success activists",
  "social movement campaign win activist",
  "government protest victory activism",
];

// Available regions
const REGIONS = [
  "North America",
  "South America",
  "Africa",
  "Asia",
  "Europe",
  "Australia"
];

export default function Home() {
  // Form inputs
  const [message, setMessage] = useState('Identify wins made by grassroots social justice organizations');
  const [region, setRegion] = useState(REGIONS[0]);
  const [queries, setQueries] = useState(DEFAULT_QUERIES.join('\n'));
  const [apiKey, setApiKey] = useState('until-all-are-free');
  
  // Process state
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  
  // Process steps
  const steps = [
    "Starting request",
    "Searching for information",
    "Processing with AI assistant",
    "Generating report",
    "Complete"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse('');
    setError('');
    setCurrentStep(1);

    try {
      // Parse queries from textarea (one per line)
      const queryList = queries.split('\n').filter(q => q.trim() !== '');
      
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message, 
          region,
          queries: queryList,
          apiKey
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start process');
      }

      const data = await res.json();
      setThreadId(data.threadId);
      setRunId(data.runId);
      setCurrentStep(2);
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoading(false);
      setCurrentStep(0);
    }
  };

  useEffect(() => {
    const pollStatus = async () => {
      if (!threadId || !runId || !loading) return;

      try {
        const res = await fetch('/api/assistant/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ threadId, runId }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to check status');
        }

        const data = await res.json();
        
        if (data.status === 'completed') {
          setResponse(data.response);
          setLoading(false);
          setThreadId(null);
          setRunId(null);
          setCurrentStep(4); // Complete
        } else if (data.error) {
          setError(data.error);
          setLoading(false);
          setCurrentStep(0);
        } else {
          // Update step based on status
          if (data.status === 'in_progress') {
            setCurrentStep(2); // Processing with AI
          } else if (data.status === 'requires_action') {
            setCurrentStep(3); // Generating report
          }
          
          // Continue polling
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while checking status');
        setLoading(false);
        setCurrentStep(0);
      }
    };

    pollStatus();
  }, [threadId, runId, loading]);

  // Format the response with Markdown-like syntax
  const formatResponse = (text: string) => {
    // Replace Markdown headers with styled divs
    const withHeaders = text.replace(/### (.*?)(\n|$)/g, '<h3 class="text-xl font-bold mt-4 mb-2 text-gray-900">$1</h3>');
    
    // Replace bullet points
    const withBullets = withHeaders.replace(/- (.*?)(\n|$)/g, '<li class="ml-4 text-gray-800">$1</li>');
    
    // Replace links
    const withLinks = withBullets.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-700 hover:text-blue-900 underline" target="_blank">$1</a>');
    
    // Replace newlines with <br>
    return withLinks.replace(/\n/g, '<br>');
  };

  return (
    <main className="max-w-4xl mx-auto p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">SMT Message Collector</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Search Parameters</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Message/Prompt</label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-gray-800 bg-white"
                placeholder="Enter your message"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Region</label>
              <select 
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-gray-800 bg-white"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Search Queries (one per line)</label>
              <textarea
                value={queries}
                onChange={(e) => setQueries(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded h-32 text-gray-800 bg-white"
                placeholder="Enter search queries (one per line)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-gray-800 bg-white"
                placeholder="Enter API key"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:bg-blue-300 font-medium"
            >
              {loading ? 'Processing...' : 'Start Search'}
            </button>
          </form>
        </div>
        
        {/* Results Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Process Status</h2>
          
          {/* Progress Steps */}
          <div className="mb-6">
            <ol className="relative border-l border-gray-300 ml-3">
              {steps.map((step, index) => (
                <li key={index} className="mb-6 ml-6">
                  <span className={`absolute flex items-center justify-center w-6 h-6 rounded-full -left-3 ring-8 ring-white ${
                    currentStep > index 
                      ? 'bg-green-600' 
                      : currentStep === index 
                        ? 'bg-blue-700 animate-pulse' 
                        : 'bg-gray-400'
                  }`}>
                    {currentStep > index ? (
                      <svg className="w-3.5 h-3.5 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5"/>
                      </svg>
                    ) : (
                      <span className="text-xs text-white">{index + 1}</span>
                    )}
                  </span>
                  <h3 className={`font-medium leading-tight ${
                    currentStep >= index ? 'text-gray-900' : 'text-gray-500'
                  }`}>{step}</h3>
                </li>
              ))}
            </ol>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="p-4 mb-4 text-sm text-red-800 bg-red-100 rounded-lg border border-red-200">
              <p>Error: {error}</p>
            </div>
          )}
          
          {/* Response */}
          {response && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2 text-gray-900">Results:</h3>
              <div 
                className="p-4 border border-gray-300 rounded bg-gray-50 max-h-[500px] overflow-y-auto text-gray-800"
                dangerouslySetInnerHTML={{ __html: formatResponse(response) }}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}