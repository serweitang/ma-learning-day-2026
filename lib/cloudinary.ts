import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a PDF buffer to Cloudinary under `memos/{maId}`.
 * Re-uploading the same maId overwrites the previous file.
 * Returns the secure URL to the file.
 */
export async function uploadToCloudinary(maId: string, buffer: Buffer): Promise<string> {
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "raw",
          public_id: `memos/${maId}`,
          overwrite: true,
          format: "pdf",
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result as { secure_url: string });
        }
      )
      .end(buffer);
  });

  return result.secure_url;
}
