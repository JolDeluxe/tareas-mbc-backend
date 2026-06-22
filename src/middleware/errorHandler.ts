import type { Request, Response, NextFunction } from "express";

const obtenerFecha = () => new Date().toLocaleString('es-MX');

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const fecha = obtenerFecha();
  
  // Identificar el tipo de error para dar un mensaje claro al cliente
  let tipoError = "Error Desconocido";
  let codigo = 500;

  if (err.code === 'P2002') { 
      tipoError = "Violación de Unicidad (Dato duplicado)"; 
      codigo = 409; 
  }
  else if (err.code === 'P2025') { 
      tipoError = "Registro no encontrado"; 
      codigo = 404; 
  }
  else if (err.name === 'ZodError') { 
      tipoError = "Datos inválidos"; 
      codigo = 400; 
  }
  else if (err.message === "No permitido por CORS") { 
      tipoError = "Bloqueo de Seguridad"; 
      codigo = 403; 
  }

  // LOG VISUAL PARA EL SERVIDOR (Detallado)
  console.error(`\n❌ [${fecha}] ERROR CRÍTICO DETECTADO`);
  console.error(`   📌 Tipo: ${tipoError}`);
  console.error(`   📂 Ruta: ${req.method} ${req.path}`);
  console.error(`   🛑 Mensaje: ${err.message}`);
  
  // Mostrar solo la primera línea del stack trace para no ensuciar la consola
  if (err.stack) {
      console.error(`   💻 Stack: ${err.stack.split('\n')[1].trim()}`); 
  }
  console.error('---------------------------------------------------------------\n');

  // RESPUESTA AL CLIENTE (Limpia)
  if (!res.headersSent) {
      res.status(codigo).json({ 
        error: true, 
        message: tipoError === "Error Desconocido" ? "Error interno del servidor" : err.message 
      });
  }
};