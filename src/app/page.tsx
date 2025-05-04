'use client';

import { useState } from 'react';

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
  const [apiKey, setApiKey] = useState('until-all-are-free');
  
  // Process state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse('');
    setError('');

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message, 
          region,
          apiKey
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      
      if (data.status === 'completed') {
        setResponse(data.response);
      } else {
        throw new Error(data.error || 'Received unexpected response from server');
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

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
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Region</label>
              <select 
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-gray-800 bg-white"
                disabled={loading}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-gray-800 bg-white"
                placeholder="Enter API key"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:bg-gray-400 font-medium transition duration-150 ease-in-out"
            >
              {loading ? 'Processing...' : 'Start Search'}
            </button>
          </form>
        </div>
        
        {/* Results Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Results</h2>
          
          {/* Loading Indicator */}
          {loading && (
            <div className="flex justify-center items-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
              <p className="ml-3 text-gray-700">Generating report...</p>
            </div>
          )}
          
          {/* Error Message */}
          {error && !loading && (
            <div className="p-4 mb-4 text-sm text-red-800 bg-red-100 rounded-lg border border-red-200">
              <p><span className="font-semibold">Error:</span> {error}</p>
            </div>
          )}
          
          {/* Response */}
          {response && !loading && (
            <div className="mt-4">
              <div 
                className="p-4 border border-gray-300 rounded bg-gray-50 max-h-[600px] overflow-y-auto text-gray-800 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formatResponse(response) }}
              />
            </div>
          )}
          {!response && !loading && !error && (
            <p className="text-gray-600 text-center py-6">Submit the form to generate a report.</p>
          )}
        </div>
      </div>
    </main>
  );
}