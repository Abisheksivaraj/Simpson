const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Increase the JSON payload size limit to 50MB
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  cors({
    origin: "https://simpson.onrender.com/",
    // origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(
  express.static("public", {
    setHeaders: (res, path) => {
      if (path.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      }
      if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      }
      if (path.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      }
    },
  })
);

// Add error handling for route imports
try {
  const login = require("./Route/LoginRoute");
  app.use("/api/auth/", login);
  console.log("✅ LoginRoute loaded successfully");
} catch (error) {
  console.error("❌ Error loading LoginRoute:", error.message);
}

try {
  const model = require("./Route/PartRoute");
  app.use("/api", model);
  console.log("✅ PartRoute loaded successfully");
} catch (error) {
  console.error("❌ Error loading PartRoute:", error.message);
}

try {
  // Fixed path - changed from ../src/Route/PrintRoute to ./Route/PrintRoute
  const printRoutes = require("./Route/PrintRoute");
  app.use("/api", printRoutes);
  console.log("✅ PrintRoute loaded successfully");
} catch (error) {
  console.error("❌ Error loading PrintRoute:", error.message);
  console.error(
    "Make sure the file exists at:",
    path.resolve(__dirname, "./Route/PrintRoute.js")
  );
}

try {
  const scanHistoryRoute = require("./Route/ScanHistoryRoute");
  app.use("/api", scanHistoryRoute);
  console.log("✅ ScanHistoryRoute loaded successfully");
} catch (error) {
  console.error("❌ Error loading ScanHistoryRoute:", error.message);
}

app.get("/", (req, res) => {
  return res.status(200).send({
    message: "Simpson backend running successfully",
    status: true,
  });
});

// Add a catch-all route for debugging 404s
app.use("*", (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    url: req.originalUrl,
    availableRoutes: [
      "GET /",
      "/api/auth/* (LoginRoute)",
      "/api/* (PartRoute)",
      "/api/* (PrintRoute)",
      "/api/* (ScanHistoryRoute)",
    ],
  });
});

module.exports = app;
