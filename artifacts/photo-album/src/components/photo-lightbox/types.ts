export interface LightboxPhoto {
  id: number;
  url: string;
  thumbnailKey?: string | null;
  name?: string | null;
  averageRating?: number | null;
  albumId?: number | null;
}
