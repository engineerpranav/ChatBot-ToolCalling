import express from "express";
import bodyParser from "body-parser";
import "dotenv/config";
import { GenerateResponse } from "./app.js";
import cors from "cors";

const app = express();
app.use(bodyParser.json());
app.use(cors());  
// POST endpoint
app.post("/chat", async (req, res) => {
  const { message,webSearch,threadId} = req.body;

  try {
    const ans = await GenerateResponse(message,webSearch,threadId);
    res.json({ reply: ans }); // ✅ proper response
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

app.get("/", (req, res) => {
  res.send("<h1>Hello World</h1>");
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
