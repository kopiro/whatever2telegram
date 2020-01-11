module.exports = {
  apps: [
    {
      name: "app",
      script: "./src/index.js",
      watch: ["./src"],
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
