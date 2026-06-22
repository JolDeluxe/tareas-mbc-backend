// prisma/seed.ts
import { PrismaClient, Rol, Tipo } from "@prisma/client";
import bcrypt from "bcryptjs";

// Inicializa Prisma
const prisma = new PrismaClient();

// Contraseñas
const DEFAULT_PASSWORD = "123456"; // Para Super Admin y Admins
const RICARDO_PASSWORD = "vaq123";
const VICTOR_PASSWORD = "143614";
const ROBERTO_PASSWORD = "rocago23";

async function main() {
  console.log("🌱 Iniciando el script de seed...");

  // 1. Hashear las contraseñas necesarias
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const ricardoHashedPassword = await bcrypt.hash(RICARDO_PASSWORD, 10);
  const victorHashedPassword = await bcrypt.hash(VICTOR_PASSWORD, 10);
  const robertoHashedPassword = await bcrypt.hash(ROBERTO_PASSWORD, 10);
  console.log("🔑 Contraseñas hasheadas.");

  // ------------------------------------------------------------------
  // 2. CREACIÓN DE DEPARTAMENTOS
  // ------------------------------------------------------------------

  // Crear o actualizar Calidad (OPERATIVO)
  const deptoCalidad = await prisma.departamento.upsert({
    where: { nombre: "Calidad" },
    update: { tipo: "OPERATIVO" },
    create: { nombre: "Calidad", tipo: "OPERATIVO" },
  });

  // Crear o actualizar Diseño (ADMINISTRATIVO, asumiendo este tipo)
  const deptoDiseno = await prisma.departamento.upsert({
    where: { nombre: "Diseño" },
    update: { tipo: "ADMINISTRATIVO" },
    create: { nombre: "Diseño", tipo: "ADMINISTRATIVO" },
  });

  console.log(
    `🏭 Deptos listos: ${deptoCalidad.nombre}, ${deptoDiseno.nombre}`
  );

  // ------------------------------------------------------------------
  // 3. HELPER PARA CREAR USUARIOS
  // ------------------------------------------------------------------
  const crearUsuario = async (
    nombre: string,
    username: string,
    rol: Rol,
    contrasenaHash: string, // Ahora recibe el hash
    deptoId: number | null
  ) => {
    // Si el usuario ya existe, al actualizar se mantiene el departamentoId y estatus
    const usuario = await prisma.usuario.upsert({
      where: { username },
      update: {
        rol,
        password: contrasenaHash, // Actualiza la contraseña si se cambia el rol/depto
        departamentoId: deptoId,
        estatus: "ACTIVO",
      },
      create: {
        nombre,
        username,
        password: contrasenaHash,
        rol,
        departamentoId: deptoId,
        estatus: "ACTIVO",
      },
    });
    console.log(`👤 Usuario procesado: [${rol}] ${username}`);
    return usuario;
  };

  // ------------------------------------------------------------------
  // 4. USUARIO SUPER_ADMIN (Global, sin departamento)
  // ------------------------------------------------------------------

  await crearUsuario(
    "Joel Isaac Rodriguez Lopez",
    "super_admin",
    "SUPER_ADMIN",
    hashedPassword,
    null
  );

  // ------------------------------------------------------------------
  // 5. USUARIOS ADMIN POR DEPARTAMENTO
  // ------------------------------------------------------------------

  // ADMIN Calidad (Contraseña: 123456)
  await crearUsuario(
    "Admin Calidad",
    "admin_calidad",
    "ADMIN",
    hashedPassword,
    deptoCalidad.id
  );

  // ADMIN Diseño (Contraseña: 123456)
  await crearUsuario(
    "Admin Diseño",
    "admin_diseno",
    "ADMIN",
    hashedPassword,
    deptoDiseno.id
  );

  // ------------------------------------------------------------------
  // 6. ENCARGADOS DE CALIDAD (con contraseñas específicas)
  // ------------------------------------------------------------------
  console.log("\n--- Sembrando ENCARGADOS de CALIDAD ---");

  // Ricardo Ojeda (Contraseña: vaq123)
  await crearUsuario(
    "Ricardo Ojeda",
    "ricardoojeda",
    "ENCARGADO",
    ricardoHashedPassword,
    deptoCalidad.id
  );

  // Victor De Haro (Contraseña: 143614)
  await crearUsuario(
    "Victor De Haro",
    "victordeharo",
    "ENCARGADO",
    victorHashedPassword,
    deptoCalidad.id
  );

  // Roberto Torres (Contraseña: rocago23)
  await crearUsuario(
    "Roberto Torres",
    "robertotorres",
    "ENCARGADO",
    robertoHashedPassword,
    deptoCalidad.id
  );

  // ------------------------------------------------------------------
  // 7. INVITADO (Opcional - manteniéndolo por si lo necesita)
  // ------------------------------------------------------------------
  await crearUsuario(
    "Visitante Externo Auditor",
    "invitado_externo",
    "INVITADO",
    hashedPassword, // Contraseña 123456 por defecto
    null
  );

  console.log("\n✅ Seed completado exitosamente.");
}

// Ejecutar el script y desconectar Prisma
main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });