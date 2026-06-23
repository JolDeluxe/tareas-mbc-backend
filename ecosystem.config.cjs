module.exports = {
  apps: [
    {
      name: "calidad-api",
      // Ruta absoluta al ejecutable real de Bun en el servidor
      script: "C:\\Users\\CUADRA\\AppData\\Roaming\\npm\\node_modules\\bun\\bin\\bun.exe",
      // Argumentos para que Bun ejecute el servidor del backend
      args: "run src/server.ts",
      // Decimos a PM2 que use directamente el ejecutable configurado arriba
      interpreter: "none",
      exec_mode: "fork",
      watch: false,
      env: {
        PORT: 3003,
        NODE_ENV: "production",
      },
      // Resiliencia
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Logs del sistema
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
