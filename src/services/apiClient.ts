// Client-side API wrapper - calls our backend instead of Gemini directly
// This keeps the API key hidden on the server

export async function callAnalysisAPI(requestBody: any) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Analysis failed');
  }

  return response.json();
}
