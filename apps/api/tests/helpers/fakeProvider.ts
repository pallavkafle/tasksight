import type {
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from "../../src/llm/types";

// Queue responses (or errors) in order. Each call takes the next one.
export class FakeProvider implements LlmProvider {
  generateCalls: GenerateRequest[] = [];
  embedCalls: EmbedRequest[] = [];
  private generateQueue: Array<GenerateResult | Error> = [];
  private embedQueue: Array<EmbedResult | Error> = [];

  queueGenerate(...steps: Array<GenerateResult | Error>): this {
    this.generateQueue.push(...steps);
    return this;
  }

  queueEmbed(...steps: Array<EmbedResult | Error>): this {
    this.embedQueue.push(...steps);
    return this;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    this.generateCalls.push(req);
    const step = this.generateQueue.shift();
    if (!step) throw new Error("FakeProvider: no generate response queued");
    if (step instanceof Error) throw step;
    return step;
  }

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    this.embedCalls.push(req);
    const step = this.embedQueue.shift();
    if (!step) throw new Error("FakeProvider: no embed response queued");
    if (step instanceof Error) throw step;
    return step;
  }
}
