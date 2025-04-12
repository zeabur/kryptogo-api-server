const express = require("express");
const app = express();
const axios = require("axios");
// Add dotenv configuration
require("dotenv").config();

// Express middleware to parse JSON request bodies - must be used before route definitions
app.use(express.json());

// Get API key from environment variables
const API_KEY = process.env.API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
// Base API URL
const BASE_API_URL = "https://wallet.kryptogo.app/v1/studio/api";

// Common function to set request headers
const getRequestHeaders = (req) => {
  return {
    "X-STUDIO-API-KEY": API_KEY,
    Accept: "application/json, text/plain, */*",
    Origin: req.headers.origin || "https://kg-test-sdk-bpcp.vercel.app",
    Referer: req.headers.referer || "https://kg-test-sdk-bpcp.vercel.app/",
    "Content-Type": "application/json",
    "X-Client-ID": CLIENT_ID,
  };
};

app.get("/", (req, res) => {
  res.send("I'm working");
});

// Endpoint to forward requests to the real API (GET /payment/intents - query all payment intents)
app.get("/api/payment/intents", async (req, res) => {
  try {
    const response = await axios.get(`${BASE_API_URL}/payment/intents`, {
      params: req.query,
      headers: getRequestHeaders(req),
    });

    res.json(response.data);
  } catch (error) {
    console.error("API request error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Error forwarding request to external API",
      details: error.response?.data || error.message,
    });
  }
});

// Endpoint to forward single payment intent creation request (POST /payment/intent - create payment intent)
app.post("/api/payment/intent", async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.fiat_amount || !req.body.fiat_currency) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "fiat_amount and fiat_currency are required fields",
      });
    }

    // Validate if fiat_currency is a valid value
    if (!["TWD", "USD"].includes(req.body.fiat_currency)) {
      return res.status(400).json({
        error: "Invalid fiat_currency",
        message: "fiat_currency must be TWD or USD",
      });
    }

    const response = await axios.post(
      `${BASE_API_URL}/payment/intent`,
      req.body,
      { headers: getRequestHeaders(req) }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("API request error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Error forwarding request to external API",
      details: error.response?.data || error.message,
    });
  }
});

// Endpoint to get a single payment intent (GET /payment/intent/:id - query specific payment intent)
app.get("/api/payment/intent/:id", async (req, res) => {
  try {
    const intentId = req.params.id;
    const response = await axios.get(
      `${BASE_API_URL}/payment/intent/${intentId}`,
      {
        params: req.query,
        headers: getRequestHeaders(req),
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("API request error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Error forwarding request to external API",
      details: error.response?.data || error.message,
    });
  }
});

// Endpoint for asset transfer (POST /asset_pro/transfer - asset transfer)
app.post("/api/asset_pro/transfer", async (req, res) => {
  try {
    const requiredFields = [
      "chain_id",
      "contract_address",
      "amount",
      "wallet_address",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        message: `Missing fields: ${missingFields.join(", ")}`,
      });
    }

    // 驗證數據格式
    if (isNaN(parseFloat(req.body.amount))) {
      return res.status(400).json({
        error: "Invalid amount",
        message: "amount must be a valid number",
      });
    }

    const response = await axios.post(
      `${BASE_API_URL}/asset_pro/transfer`,
      req.body,
      { headers: getRequestHeaders(req) }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("API request error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Error forwarding request to external API",
      details: error.response?.data || error.message,
    });
  }
});

// Webhook endpoint to receive payment status updates
app.post("/webhook", (req, res) => {
  const paymentUpdate = req.body;
  
  // Verify the payment data (recommended)
  // Process the payment update based on status
  switch(paymentUpdate.status) {
    case 'success':
      // Payment completed successfully
      console.log('Payment successful!', {
        txHash: paymentUpdate.payment_tx_hash,
        receivedAmount: paymentUpdate.received_amount,
        aggregatedAmount: paymentUpdate.aggregated_amount
      });
      break;
    case 'expired':
      // Payment window closed without receiving funds
      console.log('Payment expired', paymentUpdate);
      break;
    case 'insufficient_not_refunded':
      // User sent too little - waiting for refund
      console.log('Insufficient payment, pending refund', paymentUpdate);
      break;
    case 'insufficient_refunded':
      // Refund completed
      console.log('Insufficient payment refunded', {
        refundTxHash: paymentUpdate.refund_tx_hash,
        refundAmount: paymentUpdate.refund_amount
      });
      break;
  }
  
  // Respond to acknowledge receipt
  res.status(200).send('Webhook received');
});

const startServer = () => {
  const port = process.env.PORT || 3000;
  const server = app
    .listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is busy, trying with port ${port + 1}`);
        startServer(port + 1);
      } else {
        console.error("Server error:", err);
      }
    });

  return server;
};

// Start the server only when this file is executed directly
if (require.main === module) {
  startServer();
}

// Export app for testing purposes
module.exports = app;
