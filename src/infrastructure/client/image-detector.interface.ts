export interface ImageDetectorResponse {
  status: string;
  data: DetailsDetection; // Bạn có thể định nghĩa cụ thể hơn dựa trên kết quả của NudeNet
}

type DetailsDetection = {
    is_toxic: boolean;
    confidence_score: number;
    details: any
}

export interface IImageDetectorService {
  /**
   * Gọi tới Python API để kiểm duyệt hình ảnh
   */
  scanImage(imageUrl: string): Promise<ImageDetectorResponse>;
}