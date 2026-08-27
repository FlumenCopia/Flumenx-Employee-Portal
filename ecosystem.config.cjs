module.exports = {
  apps: [
    {
      name: "flumenx-backend",
      cwd: "./backend",
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 8000
      }
    },
    {
      name: "flumenx-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
