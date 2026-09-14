import app from "../server.js";
import agentStatusHandler from "./agent-status.js";

export default function handler(req: any, res: any) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/api/agent-status" || url.pathname === "/agent-status") {
    return agentStatusHandler(req, res);
  }
  return app(req, res);
}
