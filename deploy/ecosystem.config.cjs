module.exports = {
  apps: [
    {
      name: "stoor-store",
      script: "server.js",
      cwd: __dirname,
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
