import multer from "multer";
import type { Request, Response, NextFunction } from "express";

// 1. ALMACENAMIENTO EN MEMORIA (RAM)
// Ya no usamos CloudinaryStorage aquí. Guardamos en RAM para poder editar la foto después.
const storage = multer.memoryStorage();

// 2. FILTRO (Solo permitimos imágenes)
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen"), false);
  }
};

// 3. CONFIGURACIÓN MULTER
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    // IMPORTANTE: Permitimos 20MB de entrada.
    // Aunque el usuario suba una foto gigante, no te preocupes, 
    // la vamos a comprimir en el siguiente paso antes de que llegue a Cloudinary.
    fileSize: 20 * 1024 * 1024, 
  },
});

// -----------------------------------------------------------
// 🛡️ MIDDLEWARES EXPORTABLES
// -----------------------------------------------------------

// A) Para subir Imágenes de Tareas
export const uploadImagenesMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const uploadFn = upload.array("imagenes", 10); // Aceptamos hasta 10 fotos

  uploadFn(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ 
          error: "Archivo demasiado pesado", 
          detalle: "La imagen es mayor a 20MB antes de procesar." 
        });
      }
      return res.status(400).json({ error: "Error de subida", detalle: err.message });
    } else if (err) {
      return res.status(500).json({ error: "Error interno", detalle: err.message });
    }
    next();
  });
};

// B) Para subir Evidencias (Entregas)
// NOTA: Al cambiar esto a memoria, también tendremos que actualizar 
// el controlador de "entregarTarea" más adelante.
export const uploadEvidenciasMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const uploadFn = upload.array("evidencias", 5);

  uploadFn(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: "Error al subir evidencia" });
    next();
  });
};