import type { Request, Response } from "express";
import { prisma } from "../../../config/db.js";
import { safeAsync } from "../../../utils/safeAsync.js";
import { paramsSchema, subscriptionSchema } from "../schemas/usuario.schema.js";

export const suscribirPush = safeAsync(async (req: Request, res: Response) => {
  // 1. Validar ID de la URL
  const paramsParse = paramsSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: "ID de usuario inválido en la URL" });
  }

  const targetUserId = paramsParse.data.id;

  // 2. Seguridad: Solo el propio usuario puede suscribir SU dispositivo
  if (req.user!.id !== targetUserId) {
    return res.status(403).json({ error: "No puedes registrar notificaciones para otro usuario." });
  }

  // 3. Validar Body (Keys de Push)
  const bodyParse = subscriptionSchema.safeParse(req.body);
  if (!bodyParse.success) {
    return res.status(400).json({
      error: "Datos de suscripción inválidos",
      detalles: bodyParse.error.flatten().fieldErrors,
    });
  }

  const { endpoint, keys } = bodyParse.data;

  // 4. Upsert (Crear o Actualizar)
  // Lógica: Un endpoint de navegador es único. Si ese navegador ya estaba registrado
  // (quizás con otro usuario anterior), lo actualizamos para que apunte al usuario actual.
  const subscripcion = await prisma.pushSubscription.upsert({
    where: { endpoint: endpoint },
    create: {
      endpoint: endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      usuarioId: targetUserId,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      usuarioId: targetUserId, // Nos "robamos" la suscripción si cambió de usuario en el mismo navegador
    },
  });

  console.log(`✅ Push registrada: Usuario ${targetUserId} - Device ID: ${subscripcion.id}`);
  res.status(201).json({ message: "Suscripción exitosa" });
});