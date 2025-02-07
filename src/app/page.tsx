'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      setThreadId(data.threadId);
      setRunId(data.runId);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
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

        const data = await res.json();
        
        if (data.status === 'completed') {
          setResponse(data.response);
          setLoading(false);
          setThreadId(null);
          setRunId(null);
        } else if (data.error) {
          console.error('Error:', data.error);
          setLoading(false);
        } else {
          // Continue polling
          setTimeout(pollStatus, 1000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setLoading(false);
      }
    };

    pollStatus();
  }, [threadId, runId, loading]);

  return (
    <main className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter your message"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {loading ? 'Loading...' : 'Send'}
        </button>
      </form>
      {response && (
        <div className="mt-4 p-4 border rounded">
          <h2>Response:</h2>
          <p>{response}</p>
        </div>
      )}
    </main>
  );
}