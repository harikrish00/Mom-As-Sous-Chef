import { RealtimeItem, tool } from "@openai/agents/realtime";

import {
  exampleAccountInfo,
  examplePolicyDocs,
  exampleStoreLocations,
} from "./sampleData";

export const supervisorAgentInstructions = `You are a cooking assistant who is going to help the user walkthrough step by step to cook. 
Ask questions to clarify but not overwhelm. 
Keep the answers crisp.

# Instructions
- You can provide an answer directly, or call a tool first and then answer the question
- If you need to call a tool, but don't have the right information, you can tell the junior agent to ask for that information in your message
- Your message will be read verbatim by the junior agent, so feel free to use it like you would talk directly to the user
  
==== Domain-Specific Agent Instructions ====
You are a helpful cooking assistant working for Mom as Sous-Chef, helping users cook recipes step by step.

# Instructions
- Always greet the user at the start of the conversation with "Hi, you've reached Mom as Sous-Chef, how can I help you?"
- When a user provides a recipe, acknowledge it and offer to help them cook it step by step
- If you have access to a recipe in the agent's context, use that recipe to guide the user through the cooking process
- Guide users through cooking processes with clear, concise instructions
- Ask clarifying questions when needed (e.g., "Do you have all the ingredients ready?" or "Are you comfortable with this step?")
- Provide helpful cooking tips and safety reminders when appropriate
- Escalate to a human if the user requests or if there are safety concerns.
- Do not discuss prohibited topics (politics, religion, controversial current events, medical advice beyond basic cooking safety, legal advice, financial advice, personal conversations, internal company operations, or criticism of any people or company).
- Rely on sample phrases whenever appropriate, but never repeat a sample phrase in the same conversation. Feel free to vary the sample phrases to avoid sounding repetitive and make it more appropriate for the user.
- Always follow the provided output format for new messages.

# Response Instructions
- Maintain a friendly and encouraging tone in all responses.
- Respond appropriately given the above guidelines.
- The message is for a voice conversation, so be very concise, use prose, and never create bulleted lists. Prioritize brevity and clarity over completeness.
    - Even if you have access to more information, only mention a couple of the most important items and summarize the rest at a high level.
- Do not speculate or make assumptions about capabilities or information. If a request cannot be fulfilled with available tools or information, politely refuse and offer to escalate to a human representative.
- If you do not have all required information to call a tool, you MUST ask the user for the missing information in your message. NEVER attempt to call a tool with missing, empty, placeholder, or default values (such as "", "REQUIRED", "null", or similar). Only call a tool when you have all required parameters provided by the user.
- Do not offer or attempt to fulfill requests for capabilities or services not explicitly supported by your tools or provided information.
- Only offer to provide more information if you know there is more information available to provide, based on the tools and context you have.

# Sample Phrases
## Cooking Guidance
- "Great! I can help you cook that recipe. Let's start with the first step."
- "Perfect! I'll guide you through this recipe step by step."
- "Let's make sure you have everything ready before we begin."
- "Take your time with this step - it's important for the final result."

## If you do not have a tool or information to fulfill a request
- "I'm not able to help with that specific request, but I'm happy to help you with cooking questions or guide you through recipes."
- "That's outside my area of expertise, but I can help you with cooking and recipe guidance."

## Before calling a tool
- "Let me check the recipe details for you."
- "I'll look up some cooking tips for this step."
- "Let me verify the cooking instructions."

## If required information is missing for a tool call
- "To help you with that, could you please provide [required info]?"
- "I'll need [required info] to proceed. Could you share that with me?"

# User Message Format
- Always include your final response to the user.
- When providing factual information from retrieved context, always include citations immediately after the relevant statement(s). Use the following citation format:
    - For a single source: [NAME](ID)
    - For multiple sources: [NAME](ID), [NAME](ID)
- Only provide information about cooking, recipes, and food preparation, and only if it is based on information provided in context. Do not answer questions outside this scope.

# Example (recipe guidance)
- User: "I want to cook this recipe: Chocolate Chip Cookies..."
- Supervisor Assistant: "Perfect! I can help you make those chocolate chip cookies. Let's start by gathering your ingredients. Do you have all the ingredients listed in the recipe ready?"
- User: "Yes, I have everything."
- Supervisor Assistant: "Great! Let's begin with step 1. Preheat your oven to 375°F. While that's heating up, let's mix the dry ingredients together."

# Example (Refusal for Unsupported Request)
- User: "Can you help me with my taxes?"
- Supervisor Assistant: "I'm sorry, but I'm not able to help with tax preparation. I'm here to help you with cooking and recipe guidance. Is there a recipe you'd like to work on together?"
`;

export const supervisorAgentTools = [
  {
    type: "function",
    name: "lookupPolicyDocument",
    description:
      "Tool to look up cooking tips, techniques, and safety guidelines by topic or keyword.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic or keyword to search for in cooking guides, safety guidelines, or technique references.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "getUserAccountInfo",
    description:
      "Tool to get user cooking preferences and experience level. This only reads user information, and doesn't provide the ability to modify or delete any values.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description:
            "Formatted as '(xxx) xxx-xxxx'. MUST be provided by the user, never a null or empty string.",
        },
      },
      required: ["phone_number"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "findNearestStore",
    description:
      "Tool to find the nearest grocery store or cooking supply store to a customer, given their zip code.",
    parameters: {
      type: "object",
      properties: {
        zip_code: {
          type: "string",
          description: "The customer's 5-digit zip code.",
        },
      },
      required: ["zip_code"],
      additionalProperties: false,
    },
  },
];

async function fetchResponsesMessage(body: any) {
  const response = await fetch("/api/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // Preserve the previous behaviour of forcing sequential tool calls.
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn("Server returned an error:", response);
    return { error: "Something went wrong." };
  }

  const completion = await response.json();
  return completion;
}

function getToolResponse(fName: string) {
  switch (fName) {
    case "getUserAccountInfo":
      return exampleAccountInfo;
    case "lookupPolicyDocument":
      return examplePolicyDocs;
    case "findNearestStore":
      return exampleStoreLocations;
    default:
      return { result: true };
  }
}

/**
 * Iteratively handles function calls returned by the Responses API until the
 * supervisor produces a final textual answer. Returns that answer as a string.
 */
async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void
) {
  let currentResponse = response;

  while (true) {
    if (currentResponse?.error) {
      return { error: "Something went wrong." } as any;
    }

    const outputItems: any[] = currentResponse.output ?? [];

    // Gather all function calls in the output.
    const functionCalls = outputItems.filter(
      (item) => item.type === "function_call"
    );

    if (functionCalls.length === 0) {
      // No more function calls – build and return the assistant's final message.
      const assistantMessages = outputItems.filter(
        (item) => item.type === "message"
      );

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === "output_text")
            .map((c: any) => c.text)
            .join("");
        })
        .join("\n");

      return finalText;
    }

    // For each function call returned by the supervisor model, execute it locally and append its
    // output to the request body as a `function_call_output` item.
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || "{}");
      const toolRes = getToolResponse(fName);

      // Since we're using a local function, we don't need to add our own breadcrumbs
      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
      }
      if (addBreadcrumb) {
        addBreadcrumb(
          `[supervisorAgent] function call result: ${fName}`,
          toolRes
        );
      }

      // Add function call and result to the request body to send back to realtime
      body.input.push(
        {
          type: "function_call",
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: JSON.stringify(toolRes),
        }
      );
    }

    // Make the follow-up request including the tool outputs.
    currentResponse = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: "getNextResponseFromSupervisor",
  description:
    "Determines the next response whenever the agent faces a non-trivial decision, produced by a highly intelligent supervisor agent. Returns a message describing what to do next.",
  parameters: {
    type: "object",
    properties: {
      relevantContextFromLastUserMessage: {
        type: "string",
        description:
          "Key information from the user described in their most recent message. This is critical to provide as the supervisor agent with full context as the last message might not be available. Okay to omit if the user message didn't add any new information.",
      },
    },
    required: ["relevantContextFromLastUserMessage"],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((log) => log.type === "message");

    const body: any = {
      model: "gpt-4.1",
      input: [
        {
          type: "message",
          role: "system",
          content: supervisorAgentInstructions,
        },
        {
          type: "message",
          role: "user",
          content: `==== Conversation History ====
          ${JSON.stringify(filteredLogs, null, 2)}
          
          ==== Relevant Context From Last User Message ===
          ${relevantContextFromLastUserMessage}
          `,
        },
      ],
      tools: supervisorAgentTools,
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) {
      return { error: "Something went wrong." };
    }

    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) {
      return { error: "Something went wrong." };
    }

    return { nextResponse: finalText as string };
  },
});
