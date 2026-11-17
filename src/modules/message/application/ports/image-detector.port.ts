export type ImageDetectionDetails = {
  is_toxic: boolean;
  confidence_score: number;
  details: unknown;
};

export interface ImageDetectorResponse {
  status: string;
  data: ImageDetectionDetails;
}

export interface IImageDetectorService {
  scanImage(imageUrl: string): Promise<ImageDetectorResponse>;
}
