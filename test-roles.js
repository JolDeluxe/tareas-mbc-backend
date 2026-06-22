import axios from 'axios';
import colors from 'colors';
import fs from 'fs'; // ➕ AGREGADO
import FormData from 'form-data'; // ➕ AGREGADO

// ==========================================
// 1. CONFIGURACIÓN
// ==========================================
const BASE_URL = 'http://localhost:3000/api';
const PASSWORD_DEFAULT = '123456'; 

// ⚠️ Asegúrate de que esta ruta sea correcta en tu PC
const RUTA_IMAGEN_PRUEBA = String.raw`C:\Users\MBCPROEW10028\Downloads\imagen_ejemplo.jpg`;

const TEST_USERS = [
    { role: 'SUPER_ADMIN', username: 'super_admin' },           
    { role: 'ADMIN',       username: 'admin_calidad' },         
    { role: 'ENCARGADO',   username: 'encargado_calidad_01' },  
    { role: 'USUARIO',     username: 'usuario_calidad_01' }     
];

const sessions = {};
let dynamicData = {
    userId: null,
    deptId: null,
    taskId: null
};

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

const testRequest = async (role, method, endpoint, data = null, description = "") => {
    const token = sessions[role];
    if (!token && role !== 'PUBLIC') { 
        return;
    }

    try {
        let headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Configuración especial para subida de archivos
        if (data instanceof FormData) {
            Object.assign(headers, data.getHeaders());
        }

        const config = {
            method: method,
            url: `${BASE_URL}${endpoint}`,
            headers: headers,
            data: data
        };

        const response = await axios(config);
        const status = response.status;
        
        let statusColor = status >= 200 && status < 300 ? status.toString().green : status.toString().yellow;
        console.log(`${`[${role}]`.padEnd(12)} ${method.padEnd(6)} ${endpoint.padEnd(40)} -> ${statusColor} | ${description}`);
        return response.data;

    } catch (error) {
        let status = error.response ? error.response.status : 'ERR';
        let statusColor = status === 403 || status === 401 ? status.toString().yellow : status.toString().red;
        
        const msg = error.response?.data?.error || error.message;
        
        console.log(`${`[${role}]`.padEnd(12)} ${method.padEnd(6)} ${endpoint.padEnd(40)} -> ${statusColor} | ${msg.substring(0, 40)}...`);
        return null;
    }
};

// ==========================================
// 3. SECUENCIA DE PRUEBAS
// ==========================================

const runTests = async () => {
    console.log(`\n🚀 INICIANDO AUDITORÍA COMPLETA DE RUTAS\n`.bold.cyan);

    // =========================================================================
    // 🔐 MÓDULO: AUTH
    // =========================================================================
    console.log(`\n🔐 1. MÓDULO AUTH`.bold.white);
    
    // Login
    for (const user of TEST_USERS) {
        const res = await testRequest('PUBLIC', 'POST', '/auth/login', { username: user.username, password: PASSWORD_DEFAULT }, `Login ${user.role}`);
        if (res && res.token) sessions[user.role] = res.token;
    }

    await testRequest('USUARIO', 'GET', '/auth/verify', null, 'Verificar Token');

    // =========================================================================
    // 🏢 MÓDULO: DEPARTAMENTOS
    // =========================================================================
    console.log(`\n🏢 2. MÓDULO DEPARTAMENTOS`.bold.white);
    
    await testRequest('USUARIO', 'GET', '/departamentos', null, 'Listar Deptos (Público)');
    
    const depto = await testRequest('ADMIN', 'POST', '/departamentos', { nombre: `Depto Test ${Date.now()}`, tipo: 'OPERATIVO' }, 'Crear Depto');
    if (depto) dynamicData.deptId = depto.id;
    await testRequest('USUARIO', 'POST', '/departamentos', { nombre: 'Hack', tipo: 'OPERATIVO' }, 'Usuario intenta crear -> 403');

    if (dynamicData.deptId) {
        await testRequest('ADMIN', 'PUT', `/departamentos/${dynamicData.deptId}`, { nombre: 'Depto Editado' }, 'Editar Depto');
        await testRequest('USUARIO', 'PUT', `/departamentos/${dynamicData.deptId}`, { nombre: 'Hack' }, 'Usuario intenta editar -> 403');
    }

    // =========================================================================
    // 👥 MÓDULO: USUARIOS
    // =========================================================================
    console.log(`\n👥 3. MÓDULO USUARIOS`.bold.white);

    await testRequest('ADMIN', 'GET', '/usuarios', null, 'Get Todos');
    await testRequest('ADMIN', 'GET', '/usuarios/invitados', null, 'Get Invitados');
    await testRequest('ADMIN', 'GET', '/usuarios/usuarios', null, 'Get Solo Usuarios');
    await testRequest('ADMIN', 'GET', '/usuarios/encargados-y-usuarios', null, 'Get Encargados y Usuarios');
    
    const userPayload = { nombre: "Test Script", username: `test.${Date.now()}`, password: "password123", rol: "USUARIO", departamentoId: 1 };
    const newUser = await testRequest('SUPER_ADMIN', 'POST', '/usuarios', userPayload, 'Crear Usuario');
    if (newUser) dynamicData.userId = newUser.id;

    await testRequest('USUARIO', 'POST', '/usuarios', userPayload, 'Usuario crea Usuario -> 403');

    if (dynamicData.userId) {
        await testRequest('ENCARGADO', 'GET', `/usuarios/${dynamicData.userId}`, null, 'Ver perfil usuario');
        
        await testRequest('SUPER_ADMIN', 'PUT', `/usuarios/${dynamicData.userId}`, { nombre: 'Nombre Editado' }, 'Admin edita usuario');
        await testRequest('USUARIO', 'PUT', `/usuarios/${dynamicData.userId}`, { nombre: 'Hack' }, 'Usuario edita otro -> 403');

        await testRequest('SUPER_ADMIN', 'PUT', `/usuarios/${dynamicData.userId}/estatus`, { estatus: 'INACTIVO' }, 'Admin desactiva');
        await testRequest('USUARIO', 'PUT', `/usuarios/${dynamicData.userId}/estatus`, { estatus: 'ACTIVO' }, 'Usuario reactiva -> 403');

        await testRequest('ADMIN', 'POST', `/usuarios/${dynamicData.userId}/subscribe`, { endpoint: 'https://fake.com', keys: { p256dh: 'x', auth: 'y'} }, 'Suscribir OTRO usuario -> 403');
    }

    // =========================================================================
    // 📋 MÓDULO: TAREAS
    // =========================================================================
    console.log(`\n📋 4. MÓDULO TAREAS`.bold.white);

    // Usamos el ID del usuario "USUARIO" real (ID 7) para asignarle la tarea
    // Nota: Ajusta el ID 7 si en tu base de datos el usuario tiene otro ID
    const tareaPayload = {
        tarea: "Tarea Auditoría", fechaLimite: "2025-12-31", urgencia: "MEDIA", departamentoId: 1, responsables: [7], observaciones: "Test"
    };

    const newTask = await testRequest('ADMIN', 'POST', '/tareas', tareaPayload, 'Crear Tarea');
    if (newTask) dynamicData.taskId = newTask.id;
    await testRequest('USUARIO', 'POST', '/tareas', tareaPayload, 'Usuario crea tarea -> 403');

    await testRequest('ADMIN', 'GET', '/tareas', null, 'Get Todas');
    await testRequest('USUARIO', 'GET', '/tareas/misTareas', null, 'Get Mis Tareas');
    await testRequest('ADMIN', 'GET', '/tareas/asignadas', null, 'Get Asignadas por mi');
    if (dynamicData.taskId) await testRequest('USUARIO', 'GET', `/tareas/${dynamicData.taskId}`, null, 'Get Detalle ID');

    if (dynamicData.taskId) {
        await testRequest('ADMIN', 'PUT', `/tareas/${dynamicData.taskId}`, { urgencia: 'ALTA' }, 'Admin edita tarea');
        await testRequest('USUARIO', 'PUT', `/tareas/${dynamicData.taskId}`, { urgencia: 'BAJA' }, 'Usuario edita tarea -> 403');

        await testRequest('ADMIN', 'POST', `/tareas/${dynamicData.taskId}/historial`, { fechaAnterior: new Date(), nuevaFecha: new Date(), motivo: "Test" }, 'Agregar Historial');
        
        // --------------------------------------------------------------------------------
        // 4.5 Subir Imagen (⚠️ CORREGIDO: CREAMOS UN FORM NUEVO PARA CADA PETICIÓN)
        // --------------------------------------------------------------------------------
        if (fs.existsSync(RUTA_IMAGEN_PRUEBA)) {
            // Intento 1: ADMIN (Debe funcionar - 201)
            const formAdmin = new FormData();
            formAdmin.append('imagenes', fs.createReadStream(RUTA_IMAGEN_PRUEBA));
            await testRequest('ADMIN', 'POST', `/tareas/${dynamicData.taskId}/upload`, formAdmin, 'Subir Imagen REAL');
            
            // Intento 2: USUARIO (Debe fallar por permisos - 403, NO colgarse)
            // Creamos un stream nuevo para que no esté vacío
            const formUser = new FormData();
            formUser.append('imagenes', fs.createReadStream(RUTA_IMAGEN_PRUEBA)); 
            await testRequest('USUARIO', 'POST', `/tareas/${dynamicData.taskId}/upload`, formUser, 'Usuario sube img -> 403');
        } else {
            console.log(`[SYSTEM] ❌ ERROR: No se encontró la imagen en: ${RUTA_IMAGEN_PRUEBA}`.red);
        }
        // --------------------------------------------------------------------------------

        // 4.6 Entregar
        await testRequest('USUARIO', 'POST', `/tareas/${dynamicData.taskId}/entregar`, {}, 'Entregar (Sin archivo)');
        
        // 4.7 Revisión
        await testRequest('USUARIO', 'POST', `/tareas/${dynamicData.taskId}/revision`, { decision: 'APROBAR' }, 'Usuario revisa -> 403');
        await testRequest('ADMIN', 'POST', `/tareas/${dynamicData.taskId}/revision`, { decision: 'APROBAR' }, 'Admin revisa');

        // 4.8 Completar / Cancelar (PATCH)
        await testRequest('USUARIO', 'PATCH', `/tareas/${dynamicData.taskId}/complete`, {}, 'Usuario completa -> 403');
        await testRequest('ADMIN', 'PATCH', `/tareas/${dynamicData.taskId}/complete`, {}, 'Admin completa');
        
        await testRequest('USUARIO', 'PATCH', `/tareas/${dynamicData.taskId}/cancel`, {}, 'Usuario cancela -> 403');
        await testRequest('ADMIN', 'PATCH', `/tareas/${dynamicData.taskId}/cancel`, {}, 'Admin cancela');

        // 4.9 Borrar Imagen (Simulado con ID falso)
        await testRequest('ADMIN', 'DELETE', `/tareas/imagen/99999`, null, 'Borrar img (ID fake) -> 404');
        await testRequest('USUARIO', 'DELETE', `/tareas/imagen/99999`, null, 'Usuario borra img -> 403');
    }

    console.log(`\n🏁 AUDITORÍA FINALIZADA`.bold.cyan);
};

runTests();