import { handleSlackAssistantEventsRequest } from "../../../../../src/routes/slack-assistant-events.js";

export async function POST(request: Request): Promise<Response> {
  return handleSlackAssistantEventsRequest(request);
}
