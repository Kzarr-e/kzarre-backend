module.exports = {
  apps: [
    {
      name: "kzarre-backend-blue",
      script: "server.js",
      args: "--port=5501",
      watch: false,
    },
    {
      name: "kzarre-backend-green",
      script: "server.js",
      args: "--port=5502",
      watch: false,
    }
  ]
}
