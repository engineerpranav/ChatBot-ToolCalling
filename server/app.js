import Groq from "groq-sdk";
import "dotenv/config";
import { tavily } from "@tavily/core";
import NodeCache from "node-cache";

const groq = new Groq({ apiKey: process.env.API_KEY });
const tvly = tavily({ apiKey: process.env.tvly });
const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });

export async function GenerateResponse(message, webSearchCheck,threadId) {
  const baseMessageArray = [
    // Set an optional system message. This sets the behavior of the
    // assistant and can be used to provide specific instructions for
    // how it should behave throughout the conversation.
    {
      role: "system",
      content: `You are a smart assistant chatbot. Always reply in plain text only — no markdown, no bullets, no special characters. Use short, simple sentences.

You were created by Mr. Pranav Purohit, an AI Powered Full Stack Software Engineer at Cubexo Software Solution owned by Prateek Gupta.

WHEN TO USE webSearch (current/real-time information):

Weather queries:
User: "weather in Mumbai" → Use webSearch("current weather Mumbai")
User: "will it rain today" → Use webSearch("rain forecast today [location]")
User: "temperature now" → Use webSearch("current temperature [location]")

News and events:
User: "latest news" → Use webSearch("latest news today")
User: "what happened today" → Use webSearch("news today")
User: "trending topics" → Use webSearch("trending topics today")

Sports and scores:
User: "cricket score" → Use webSearch("cricket match score today")
User: "who won yesterday" → Use webSearch("match results yesterday")
User: "IPL updates" → Use webSearch("IPL latest updates")

Financial data:
User: "Bitcoin price" → Use webSearch("Bitcoin price today")
User: "stock market" → Use webSearch("stock market today")
User: "dollar rate" → Use webSearch("dollar to rupee rate today")

Time-sensitive info:
User: "what time sunset" → Use webSearch("sunset time today [location]")
User: "current events" → Use webSearch("current events [topic]")
User: "latest update on [topic]" → Use webSearch("latest [topic] update")

WHEN NOT TO USE webSearch (answer directly):

About yourself:
User: "who created you"
You: "I was created by Pranav Purohit. He is an AI Powered Full Stack Software Engineer at Cubexo Software Solution."

User: "who owns Cubexo"
You: "Prateek Gupta owns Cubexo Software Solution."

General knowledge:
User: "capital of India"
You: "The capital of India is New Delhi."

User: "what is Python"
You: "Python is a popular programming language. It is easy to learn and used for web development, data science, and automation."

Math and calculations:
User: "what is 15 times 8"
You: "15 times 8 equals 120."

How-to and advice:
User: "how to learn coding"
You: "Start with basics like HTML, CSS, and JavaScript. Practice daily and build small projects. Use free resources like YouTube and online courses."

Personal interactions:
User: "how are you"
You: "I am doing great. Thank you for asking. How can I help you today?"

User: "tell me a joke"
You: "Why do programmers prefer dark mode? Because light attracts bugs!"

Remember: Use webSearch for anything with words like "today", "now", "latest", "current", "recent", or "live". Answer directly for general knowledge and personal questions.`,
    },
    // Set a user message for the assistant to respond to.
  ];

  
  const messageArray=cache.get(threadId) ?? baseMessageArray;

  messageArray.push({
    role: "user",
    content: message,
  });

  async function callLLM(messageArray, webSearchCheck) {
    console.log({ messageArray });
    try {
      const completion = await getGroqChatCompletion(
        messageArray,
        webSearchCheck
      );
      const message = completion.choices[0].message;

      messageArray.push(message);
      console.log(message);

      // Check if tool_calls exist and are properly formatted
      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
          console.log(toolCall);

          if (toolCall.function.name === "webSearch") {
            const response = await webSearch(
              JSON.parse(toolCall.function.arguments)
            );
            response.tool_call_id = toolCall.id;
            messageArray.push(response);
            return await callLLM(messageArray, webSearchCheck);
          } else {
            return `No tool access for ${toolCall.function.name}`;
          }
        }
      } else if (message.content) {

        cache.set(threadId,messageArray)

        return message.content;
      } else {
        return "Server error: Invalid response format";
      }
    } catch (error) {
      console.error("LLM call error:", error);

      // If it's a tool call validation error, return without tools
      if (
        error.status === 400 &&
        error.error?.error?.code === "tool_use_failed"
      ) {
        console.log("Tool call failed, retrying without tools...");
        // Optionally retry without tools or return the failed generation
        return "I'm having trouble processing your request. Please try rephrasing.";
      }

      throw error;
    }
  }

  const final_answer = await callLLM(messageArray, webSearchCheck);
  return final_answer;
}

export const getGroqChatCompletion = async (messageArray, webSearchCheck) => {
  return groq.chat.completions.create({
    temperature: 0.5,
    //top_p //stop
    max_completion_tokens: 1000,
    // response_format:{type:"json_object"},
    // frequency_penalty to limit repeation word
    messages: messageArray,
    tools: [
      {
        type: "function",
        function: {
          name: "webSearch",
          description: "Get or Search the latest and realtime data",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "query which user is searching on",
              },
            },
            required: ["query"],
          },
        },
      },
    ],
    tool_choice: "auto",
    model: "llama-3.3-70b-versatile",
  });
};

async function webSearch({ query }) {
  const response = await tvly.search(query);
  let contentData = response.results.map((ele) => ele.content).join("\n\n");

  contentData = contentData
    .replace(/\*\*(.*?)\*\*/g, "$1") // remove bold markdown
    .replace(/\n+/g, " ") // remove line breaks
    .replace(/[-•]/g, "") // remove bullet marks
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();

  return {
    role: "tool",
    tool_call_id: null,
    name: "webSearch",
    content: contentData,
  };
}

//output format you can struture likein json format etc {"key",value}
// we can use zod as wll for product schema  refere textgeneration grok cloud docs
// you can use json schema as well that's an new method which is present in open ai docs
// to use tool you can refer docs where the syntax would mention
