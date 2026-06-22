import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { envs } from '../config/envs.js'; 

// 1. Configuración de Cloudinary
// ALERTA: La librería 'cloudinary' lee automáticamente la variable CLOUDINARY_URL del .env
// No necesitamos pasar api_key ni api_secret manualmente si esa URL existe.
cloudinary.config({
  secure: true, // Forzar HTTPS
});

// Por seguridad extra, si la librería no detectara el .env por alguna razón,
// forzamos a que use la URL que validaste en tu archivo envs.ts
if (!process.env.CLOUDINARY_URL) {
  process.env.CLOUDINARY_URL = envs.CLOUDINARY_URL;
}

/**
 * 🚀 LA TRITURADORA:
 * Recibe un Buffer (imagen en memoria RAM), lo redimensiona a HD y lo comprime a WebP.
 * Retorna el resultado de la subida a Cloudinary.
 */
export const uploadImageBuffer = async (buffer: Buffer, folder: string = 'tareas'): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    try {
      // A) Optimizar con Sharp
      const optimizedBuffer = await sharp(buffer)
        .resize({
          width: 1280, // Reducir a 1280px (HD)
          withoutEnlargement: true, // No estirar si es pequeña
          fit: 'inside', // Mantener proporciones
        })
        .toFormat('webp', {
          quality: 80, // Calidad 80%
          effort: 6, // Máxima compresión posible
        })
        .toBuffer();

      // B) Subir a Cloudinary usando un Stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'image',
          format: 'webp',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      // C) Enviar la imagen optimizada al stream
      uploadStream.end(optimizedBuffer);

    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Borra una imagen de Cloudinary usando su Public ID
 */
export const deleteImage = async (publicId: string): Promise<any> => {
  return cloudinary.uploader.destroy(publicId);
};

/**
 * Extrae el Public ID de una URL de Cloudinary.
 */
export const getPublicIdFromCloudinaryUrl = (
  url: string,
  folder: string
): string | null => {
  const regex = new RegExp(`v\\d+\\/(${folder}\\/[^\\/\\.]+)`);
  
  const match = url.match(regex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
};