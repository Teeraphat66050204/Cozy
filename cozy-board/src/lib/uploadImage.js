import { supabase } from "./supabaseClient";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    image.src = url;
  });
}

async function compressImage(file) {
  const image = await loadImage(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas is not supported in this browser");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) {
    throw new Error("Image compression failed");
  }

  return blob;
}

export async function uploadPolaroidImage({ roomId, itemId, file }) {
  const compressedBlob = await compressImage(file);
  const filePath = `${roomId}/${itemId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("polaroids")
    .upload(filePath, compressedBlob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from("polaroids").getPublicUrl(filePath);
  return data.publicUrl;
}
