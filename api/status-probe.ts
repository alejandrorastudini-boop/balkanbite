export default function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(401).json({ error: "authentication_required" });
}
