export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    status: "Serverless Endpoint Active",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}