import type { EmbeddingEngine } from './matcher';

/**
 * Local embedding engine using Transformers.js (ONNX Runtime Web).
 * Runs inside an Offscreen Document since Service Workers can't use WASM.
 */
export class LocalEmbeddingEngine implements EmbeddingEngine {
  private pipeline: any = null;
  private modelName: string;

  constructor(modelName = 'Xenova/multilingual-e5-small') {
    this.modelName = modelName;
  }

  private async getPipeline() {
    if (!this.pipeline) {
      // Dynamic import — only loaded when needed
      // これにより，モデルの読み込みによる遅延を軽減する
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', this.modelName, {
        quantized: true,
      });
    }
    return this.pipeline;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const pipe = await this.getPipeline();
    // 平均プーリング + 正規化されたベクトルを返すようにする
    const result = await pipe(texts, { pooling: 'mean', normalize: true });
    // result.tolist() returns number[][]
    return result.tolist() as number[][];
  }
}
