import { getApiHealth } from "../../../src/index.js";

export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    ...getApiHealth()
  });
}
