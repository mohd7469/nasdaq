export default function handler(req, res) {
  // Completely Open CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  return res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}