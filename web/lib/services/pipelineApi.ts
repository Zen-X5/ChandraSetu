import { api } from './api.setup';

export interface SampleDataset {
  id: string;
  name: string;
  path: string;
  files: string[];
}

export interface PipelineRunResponse {
  _id: string;
  runId: string;
  sourceImageId: string | Record<string, unknown>;
  referenceImageId?: string | Record<string, unknown>;
  currentStage: 'INGESTION' | 'GEOMETRY' | 'MATCHING' | 'VALIDATION' | 'COMPLETED' | 'FAILED';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  geometryResult?: {
    status: 'SUCCESS' | 'INSUFFICIENT_GEODATA' | 'NO_OVERLAP' | 'ERROR';
    message: string;
    image_a_bounds?: {
      min_lat: number;
      max_lat: number;
      min_lon: number;
      max_lon: number;
      center_lat?: number;
      center_lon?: number;
    };
    image_b_bounds?: {
      min_lat: number;
      max_lat: number;
      min_lon: number;
      max_lon: number;
      center_lat?: number;
      center_lon?: number;
    };
    overlap_bounds?: {
      min_lat: number;
      max_lat: number;
      min_lon: number;
      max_lon: number;
    };
    overlap_ratio: number;
    coarse_affine_matrix?: number[][];
    details?: Record<string, unknown>;
  };
  matchingResult?: Record<string, unknown>;
  validationResult?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export const pipelineApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSamples: builder.query<SampleDataset[], void>({
      query: () => '/images/samples',
      providesTags: ['RawImage'],
    }),
    registerSample: builder.mutation<PipelineRunResponse, { sampleId: string }>({
      query: (body) => ({
        url: '/pipeline/register-sample',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['PipelineRun'],
    }),
    registerPair: builder.mutation<PipelineRunResponse, FormData>({
      query: (formData) => ({
        url: '/pipeline/register',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['PipelineRun'],
    }),
    getRunStatus: builder.query<PipelineRunResponse, string>({
      query: (runId) => `/pipeline/run/${runId}`,
      providesTags: (_result, _error, id) => [{ type: 'PipelineRun', id }],
    }),
  }),
});

export const {
  useGetSamplesQuery,
  useRegisterSampleMutation,
  useRegisterPairMutation,
  useGetRunStatusQuery,
} = pipelineApi;
