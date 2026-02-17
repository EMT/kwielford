import { handleSlackThreadSummaryCommandRequest } from "../../../../src/routes/slack-thread-summary-command.js";

export async function POST(request: Request): Promise<Response> {
  return handleSlackThreadSummaryCommandRequest(request);
}
