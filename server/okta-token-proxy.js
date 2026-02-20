// Standalone Okta Token Exchange Proxy
// Run: node okta-token-proxy.js
// Listens on PORT (default 3001)

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.OKTA_PROXY_PORT || 3001;

app.use(cors());
app.use(express.json());

app.post("/okta-token", async (req, res) => {
  try {
    const { code, redirectUri, domain, clientId, clientSecret } = req.body;

    if (!code || !redirectUri || !domain || !clientId || !clientSecret) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tokenUrl = `${domain.replace(/\/$/, "")}/oauth2/v1/token`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const oktaRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await oktaRes.json();
    res.status(oktaRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Okta token proxy running on http://0.0.0.0:${PORT}/okta-token`);
});
