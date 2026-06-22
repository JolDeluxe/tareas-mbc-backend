import { PrismaClient, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Lista MANUALMENTE corregida y verificada
// Formato: { nombre: "Nombre Correcto", username: "usuarioOriginal", password: "passwordManual" }
const listaUsuarios = [
  // --- Parte 1: Estaban bien ---
  { nombre: "Claudia Vargas", username: "claudiavargas", password: "cvargas" },
  { nombre: "Valeria Cisneros", username: "valeriacisneros", password: "vcisneros" },
  { nombre: "Berenice Díaz", username: "berenicedíaz", password: "bdiaz" },
  { nombre: "Pablo Cortes", username: "pablocortes", password: "pcortes" },
  { nombre: "Ricardo Vera", username: "ricardovera", password: "rvera" },
  { nombre: "Agustin Acosta", username: "agustinacosta", password: "aacosta" },
  { nombre: "Cristobal Bautistas", username: "cristobalbautistas", password: "cbautistas" },
  { nombre: "Gabriela Sanchez", username: "gabrielasanchez", password: "gsanchez" },
  { nombre: "Juan Castillo", username: "juancastillo", password: "jcastillo" },
  { nombre: "Alejandro Mendoza", username: "alejandromendoza", password: "amendoza" },
  { nombre: "Gabriel Belmonte", username: "gabrielbelmonte", password: "gbelmonte" },
  { nombre: "Fernando Castillo", username: "fernandocastillo", password: "fcastillo" },
  { nombre: "Diego Sanchez", username: "diegosanchez", password: "dsanchez" },
  { nombre: "Arturo Hernández Hernández", username: "arturohernández", password: "ahernandez" },
  { nombre: "Manuel Oswaldo Gonzalez Ortiz", username: "manueloswaldo", password: "mgonzalez" },
  { nombre: "Luis Alberto Talco Michaca", username: "luisalberto", password: "ltalco" },
  { nombre: "Jorge de Jesus Macias Hernandez", username: "jorgede", password: "jmacias" },
  { nombre: "Laura Guadalupe Aguayo Ornelas", username: "lauraguadalupe", password: "laguayo" },
  { nombre: "Luz Goretti Gonzalez Cervantes", username: "luzgoretti", password: "lgonzalez" },
  { nombre: "Maria Carolina Plascencia Gutierrez", username: "mariacarolina", password: "mplascencia" },
  { nombre: "Norma López Muñoz", username: "normalópez", password: "nlopez" },
  { nombre: "Ana Luisa Zavala Cerroblanco", username: "analuisa", password: "azavala" },
  { nombre: "Roberto Hernández Lugo", username: "robertohernández", password: "rhernandez" },
  { nombre: "Emma Castañeda Garduño", username: "emmacastañeda", password: "ecastaneda" },
  { nombre: "Oscar Montes de Oca", username: "oscarmontes", password: "omontes" },
  { nombre: "Carolina Díaz Lira", username: "carolinadíaz", password: "cdiaz" },
  { nombre: "Juan Carlos Villegas González", username: "juancarlos", password: "jvillegas" },
  { nombre: "Adán Alejandro Hernández Esparza", username: "adánalejandro", password: "ahernandez" },
  { nombre: "Rubén Adrián Olivos Becerril", username: "rubénadrián", password: "rolivos" },
  { nombre: "Sergio Arenas", username: "sergioarenas", password: "sarenas" },
  { nombre: "Karen Limón", username: "karenlimón", password: "klimon" },
  { nombre: "Eduardo Mejia", username: "eduardomejia", password: "emejia" },
  { nombre: "Isaias Escobar", username: "isaiasescobar", password: "iescobar" },
  { nombre: "Alma Martinez", username: "almamartinez", password: "amartinez" },
  { nombre: "Paola Gonzalez", username: "paolagonzalez", password: "pgonzalez" },
  { nombre: "Ana Laura Barron", username: "analaura", password: "abarron" },
  { nombre: "Jose Valadez", username: "josevaladez", password: "jvaladez" },
  { nombre: "Lizbeth Bustamante", username: "lizbethbustamante", password: "lbustamante" },
  { nombre: "David Sanchez", username: "davidsanchez", password: "dsanchez" },
  { nombre: "Jose Luis Andrade", username: "joseluis", password: "jandrade" },
  { nombre: "Nallely Padilla", username: "nallelypadilla", password: "npadilla" },
  { nombre: "Pablo Gutierrez", username: "pablogutierrez", password: "pgutierrez" },
  { nombre: "Oswaldo Hernandez", username: "oswaldohernandez", password: "ohernandez" },
  { nombre: "Karime Teriquez", username: "karimeteriquez", password: "kteriquez" },
  { nombre: "Carlos Espinoz", username: "carlosespinoz", password: "cespinoz" },
  { nombre: "Jaime Meza", username: "jaimemeza", password: "jmeza" },
  { nombre: "Pedro Rangel", username: "pedrorangel", password: "prangel" },
  { nombre: "Fernando Ramos", username: "fernandoramos", password: "framos" },
  { nombre: "Daniel Hernandez", username: "danielhernandez", password: "dhernandez" },
  { nombre: "Ricardo Briano", username: "ricardobriano", password: "rbriano" },

  // --- Parte 2: CORREGIDOS (Estaban al revés, ahora están Nombre -> Apellidos) ---
  { nombre: "Jorge Fabian Espinosa Valadez", username: "espinosavaladez", password: "jespinosa" },
  { nombre: "Cruz Isaac Arriaga Barroso", username: "arriagabarroso", password: "carriaga" },
  { nombre: "Ma. del Carmen Godinez Grimaldo", username: "godinezgrimaldo", password: "mgodinez" },
  { nombre: "Oscar Antonio Lopez Moreno", username: "lopezmoreno", password: "olopez" },
  { nombre: "Jose de la luz Alcala Valtierra", username: "alcalavaltierra", password: "jalcala" },
  { nombre: "Yasmin Alejandra Vargas Callado", username: "vargascallado", password: "yvargas" },
  { nombre: "Hector Fabian Cruz Villalpando", username: "cruzvillalpando", password: "hcruz" },
  { nombre: "Mario Antonio Ramirez Zuñiga", username: "ramirezzuñiga", password: "mramirez" },
  { nombre: "Nayir Aldana Araiza", username: "aldanaaraiza", password: "naldana" },
  { nombre: "Jose Miguel Angel Gomez Santibañez", username: "gomezsantibañez", password: "jgomez" },
  { nombre: "Cecilia Alcantar Lopez", username: "alcantarlopez", password: "calcantar" },
  { nombre: "Susana Rea Ortiz", username: "reaortiz", password: "srea" },
  { nombre: "Juan Francisco Aguirre Velasco", username: "aguirrevelasco", password: "jaguirre" },
  { nombre: "Jose Perez Rosillo", username: "perezrosillo", password: "jperez" },
  { nombre: "Joaldi Ramon Padron Ledezma", username: "padronledezma", password: "jpadron" },
  { nombre: "Valeria Estefania Palafox Sierra", username: "palafoxsierra", password: "vpalafox" },
  { nombre: "Gabriela Yochabed Gaona Perez", username: "gaonaperez", password: "ggaona" },
  { nombre: "Rodrigo Correa Ortiz", username: "correaortiz", password: "rcorrea" },
  { nombre: "Ricardo Ramirez Rodriguez", username: "ramirezrodriguez", password: "rramirez" },
  { nombre: "Jorge de Jesus Macias Hernandez", username: "maciashernandez", password: "jmacias" },
  { nombre: "Ana Karina Aranda Reynoso", username: "arandareynoso", password: "aaranda" },
  { nombre: "Ruben Adrian Olivos Becerril", username: "olivosbecerril", password: "rolivos" },
  { nombre: "Ascencion Alejandro Merino Velazquez", username: "merinovelazquez", password: "amerino" }
];

async function main() {
  console.log(`🚀 Iniciando carga de ${listaUsuarios.length} INVITADOS...`);
  
  let exitosos = 0;

  for (const usuario of listaUsuarios) {
    try {
      // Hasheamos la contraseña manual definida en el JSON
      const hashedPassword = await bcrypt.hash(usuario.password, 10);

      await prisma.usuario.upsert({
        where: { username: usuario.username },
        update: {
          // Si ya existe, actualizamos nombre y password por si estaban mal antes
          nombre: usuario.nombre,
          password: hashedPassword
        },
        create: {
          nombre: usuario.nombre,
          username: usuario.username,
          password: hashedPassword,
          rol: Rol.INVITADO,
          estatus: "ACTIVO"
        }
      });
      
      console.log(`✅ OK: ${usuario.nombre} (${usuario.username}) -> Pass: ${usuario.password}`);
      exitosos++;
    } catch (error) {
      console.error(`❌ Error en ${usuario.username}:`, error);
    }
  }

  console.log(`\n🎉 Terminado. ${exitosos} usuarios procesados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });