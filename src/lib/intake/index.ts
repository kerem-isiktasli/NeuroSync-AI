/**
 * Universal Medical Intake — Entry point.
 * Inspects files, classifies batches, routes to correct pipelines.
 */

export * from "./types";
export { classifyFile } from "./fileClassifier";
export { classifyBatch, type FileInput } from "./batchClassifier";
export { routeToPipeline, type PipelineRoute } from "./pipelineRouter";
export {
  buildLimitedOutputMeta,
  type UniversalOutput,
  type UniversalOutputMeta,
} from "./universalOutput";
