import { tavily } from "@tavily/core";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');

  if (!search) {
    return Response.json({ error: 'Search parameter is required' }, { status: 400 });
  }

  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const response = await tvly.search(search, {
    num_results: 10,
  });
  console.log(response);

  return Response.json(response);
}
