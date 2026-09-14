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
    // PDS4 4-corner precise footprints — present when XML label is provided
    // Each key is upper_left / upper_right / lower_left / lower_right → [lat_deg, lon_deg]
    image_a_corners?: Record<string, [number, number]>;
    image_b_corners?: Record<string, [number, number]>;
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
  matchingResult?: {
    status: 'SUCCESS' | 'NO_MATCHES' | 'SKIPPED' | 'ERROR';
    message: string;
    method_used: string;
    candidate_matches: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      confidence: number;
      method: string;
      grid_row?: number;
      grid_col?: number;
    }>;
    spatial_coverage_ratio?: number;
    peak_correlation_score?: number;
    scale_factor?: number;
    rotation_deg?: number;
    details?: Record<string, unknown>;
  };
  validationResult?: {
    status: 'MATCHED' | 'UNCERTAIN' | 'UNMATCHED';
    message: string;
    final_transform_matrix: number[][];
    residual_transform_matrix?: number[][];
    confidence: {
      inlier_count: number;
      total_candidates: number;
      inlier_ratio: number;
      rmse_x_px: number;
      rmse_y_px: number;
      total_rmse_px: number;
      spatial_distribution_score: number;
      match_status: 'MATCHED' | 'UNCERTAIN' | 'UNMATCHED';
    };
    inlier_matches: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      residual_error_px: number;
      is_inlier: boolean;
      grid_row?: number;
      grid_col?: number;
    }>;
    outlier_matches: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      residual_error_px: number;
      is_inlier: boolean;
      grid_row?: number;
      grid_col?: number;
    }>;
    details?: {
      rmse_x?: number;
      rmse_y?: number;
      total_rmse?: number;
      spatial_entropy?: number;
      ransac_iterations_used?: number;
    };
  };
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
    getAllObservations: builder.query<PipelineRunResponse[], void>({
      query: () => '/pipeline/observations',
      providesTags: ['PipelineRun'],
    }),
  }),
});

export const {
  useGetSamplesQuery,
  useRegisterSampleMutation,
  useRegisterPairMutation,
  useGetRunStatusQuery,
  useGetAllObservationsQuery,
} = pipelineApi;
