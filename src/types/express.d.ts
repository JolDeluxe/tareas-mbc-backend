// types/express.d.ts

export {};

// Declaración de tipos globales para Express
declare global {
  namespace Express {
    interface Request {
      /**
       * Información del usuario autenticado
       * Agregada por el middleware de JWT
       */
      user?: {
        id: number;
        nombre: string;
        username: string;
        rol: "SUPER_ADMIN" | "ADMIN" | "ENCARGADO" | "USUARIO" | "INVITADO";
        departamentoId: number | null;
      };
    }
  }
}