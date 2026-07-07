// index.mjs
import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

// Use Titan Text model for generation
const MODEL_ID = process.env.MODEL_ID || "amazon.titan-text-premier-v1:0";
// Your KB ID from step A.3
const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const messages = body.messages || [];
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const query = (lastUser?.content || "Hello").slice(0, 4000);

    const systemPreamble =
      "You are MediChat, an assistant for medication support. " +
      "Summarize and explain health reports and medicines using the provided knowledge base. " +
      "Do not provide medical diagnosis. Encourage consulting licensed professionals. " +
      "Cite sources when possible.";

    const cmd = new RetrieveAndGenerateCommand({
      input: { text: `${systemPreamble}\n\nUser:\n${query}` },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: KNOWLEDGE_BASE_ID,
          modelArn: `arn:aws:bedrock:${process.env.AWS_REGION || "us-east-1"}::foundation-model/${MODEL_ID}`,
          retrievalConfiguration: {
            vectorSearchConfiguration: { numberOfResults: 6 }
          }
        }
      }
    });

    const resp = await client.send(cmd);

    const answer =
      resp.output?.text ||
      resp.output?.content?.[0]?.text ||
      "Sorry, I couldn't find an answer.";

    const sources = (resp.citations || []).flatMap(c =>
      (c.retrievedReferences || []).map(r => ({
        title: r.metadata?.title || r.metadata?.source || r.location?.s3Location?.uri || "Source",
        url: r.metadata?.url || undefined,
        snippet: r.content?.text || undefined
      }))
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: answer, sources: sources.slice(0, 6) })
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: String(e) };
  }
};