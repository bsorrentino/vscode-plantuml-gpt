import { END, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableLambda, RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonMarkdownStructuredOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as hub from "langchain/hub";
import * as fs from 'node:fs/promises';


// diagram schema
const participantSchema = z.object({
  name: z.string().describe('participant name'),
  shape: z.string().describe('participant shape'), // can be an enum ?
  description: z.string().describe('participant description')
});

const relationSchema = z.object({
  source: z.string().describe('source participant'),
  target: z.string().describe('target participant'),
  description: z.string().describe('relation description')
});

const containerSchema = z.object({
  name: z.string().describe('container name'),
  children: z.array(z.string()).describe('list of contained elements name'), // can be an enum ?
  description: z.string().describe('container description')
});

const diagramSchema = z.object({
  type: z.string().describe('Diagram tipology (one word). Eg. "sequence", "class", "process", etc."'),
  title: z.string().describe("Diagram summary (max one line) or title (if any)"),
  participants: z.array(participantSchema).describe("list of participants in the diagram "),
  relations: z.array(relationSchema).describe("list of relations in the diagram"),
  containers: z.array(containerSchema).describe("list of participants that contain other ones in the diagram"),
  description: z.array(z.string()).describe("Step by step description of the diagram with clear indication of participants and actions between them."),

});

export interface AgentState {
  diagramCode: string|null;
  diagram: z.infer<typeof diagramSchema> | null
}

export async function describeDiagramImage(llmVision: ChatOpenAI, imageUrl: string,state: AgentState, config?: RunnableConfig): Promise<Partial<AgentState>> {

  const promptTemplate = await hub.pull<PromptTemplate>("bsorrentino/describe_diagram_image");
  // <any> needs to avoid: TS2589: Type instantiation is excessively deep and possibly infinite.
  const outputParser = JsonMarkdownStructuredOutputParser.fromZodSchema( <any>diagramSchema);

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const prompt = await promptTemplate.format({ format_instructions: outputParser.getFormatInstructions() });

  // console.debug(prompt);

  const messages = new HumanMessage({
    content: [
      {
        "type": "text",
        "text": prompt
      },
      {
        "type": "image_url",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "image_url": {
          "url": imageUrl
        },
      },

    ]
  });

  const chain = llmVision.pipe(outputParser);

  const response = await chain.invoke([messages]);

  // console.debug( response  );

  return { diagram: response, diagramCode: null };
}




async function translateGenericDiagramDescriptionToPlantUML(llm: ChatOpenAI, state: AgentState, options?: Partial<RunnableConfig>): Promise<Partial<AgentState>> {

  const prompt = await hub.pull<PromptTemplate>("bsorrentino/convert_generic_diagram_to_plantuml");

  const { diagram } = state;

  if (!diagram) {
    throw new Error(`diagram object not found in state`);
  }

  const parser = new StringOutputParser();

  const chain = prompt.pipe(llm).pipe(parser);

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const result = await chain.invoke({ diagram_description: JSON.stringify(diagram) });

  return { diagramCode: result };
}

async function translateSequenceDiagramDescriptionToPlantUML(llm: ChatOpenAI, state: AgentState, options?: Partial<RunnableConfig>): Promise<Partial<AgentState>> {

  const prompt = await hub.pull<PromptTemplate>("bsorrentino/convert_sequence_diagram_to_plantuml");

  const { diagram } = state;

  if (!diagram) {
    throw new Error(`diagram object not found in state`);
  }

  const parser = new StringOutputParser();

  const chain = prompt.pipe(llm).pipe(parser);

  const result = await chain.invoke({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    diagram_title: diagram.title,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    diagram_description: diagram.description.join('\n')

  });

  return { diagramCode: result };
}

const routeDiagramTranslation = (state: AgentState) => {
  if (state?.diagram?.type === "sequence") {
    return "sequence";
  } else {
    return "generic";
  }
};

function executeGraph( args: { imageUrl: string, apiKey: string } ) {

  const { apiKey, imageUrl } = args;

  const llm = new ChatOpenAI({
    apiKey: apiKey,
    modelName: "gpt-3.5-turbo",
    maxTokens: 2000,
    temperature: 0,
    maxRetries: 1,
  });

  const llmVision = new ChatOpenAI({
    apiKey: apiKey,
    modelName: "gpt-4-vision-preview",
    maxTokens: 2000,
    temperature: 0,
    maxRetries: 1,
  });

  const agentState = {
    diagramCode: { value: null },
    diagram: { value: null }
  };

  const workflow = new StateGraph<AgentState>( { channels: agentState } );

  workflow.addNode("agent_describer", new RunnableLambda({
    func: (state, config) => describeDiagramImage(llmVision, imageUrl, state, config)
  }));
  workflow.addNode("agent_sequence_plantuml", new RunnableLambda({
    func: (state, config) => translateSequenceDiagramDescriptionToPlantUML(llm, state, config)
  }));
  workflow.addNode("agent_gemeric_plantuml", new RunnableLambda({
    func: (state, config) => translateGenericDiagramDescriptionToPlantUML(llm, state, config)
  }));
  workflow.addEdge('agent_sequence_plantuml', END);
  workflow.addEdge('agent_gemeric_plantuml', END);
  workflow.addConditionalEdges(
    "agent_describer",
    routeDiagramTranslation,
    {
      "sequence": "agent_sequence_plantuml",
      "generic": "agent_gemeric_plantuml",
    }
  );
  workflow.setEntryPoint('agent_describer');

  const app = workflow.compile();

  return app.stream( { diagram: null, diagramCode: null } );
}

const imageFileToUrl = async (imagePath: string) => {

  const imageBuffer = await fs.readFile(imagePath);
  // const imageContent = await vscode.workspace.fs.readFile(vscode.Uri.file(imagePath));
  // const imageBuffer = Buffer.from(imageContent);

  const base64EncodedImage = imageBuffer.toString('base64');
  return `data:image/png;base64,${base64EncodedImage}`;
};

const isUrl = (source: string) => {
  try {
    new URL(source);
    return true;
  } catch (_) {
    return false;
  }
};

const isFileExist = async (filePath: string) => {
  try {
    // await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

export const imageUrlToDiagram = async (args: { imageUrl: string | undefined, apiKey: string }) => {
  const { apiKey, imageUrl } = args;
  if (!imageUrl || !isUrl(imageUrl)) {
    throw new Error(`Invalid image url: ${imageUrl}`);
  }

  return await executeGraph( { apiKey, imageUrl } );
  
};

export const imageFileToDiagram = async (args: { imageFile: string, apiKey: string }) => {

  const { apiKey, imageFile } = args;

  if (!imageFile || !await isFileExist(imageFile)) {
    throw new Error(`Invalid image file: ${imageFile}`);
  }

  const imageUrl = await imageFileToUrl(imageFile);

  if (!imageUrl) {
    throw new Error(`Invalid image file: ${imageFile}`);
  }

  return await executeGraph( { apiKey, imageUrl } );

};
