import express from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set large JSON body limit for transferring graph edge structures and base64 plots
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Simulator Endpoint
  app.post("/api/simulate", (req, res) => {
    const pythonProcess = spawn("python3", ["./simulate.py"]);
    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}. Stderr: ${stderrData}`);
        res.status(500).json({
          error: `Simulation script failed (code ${code}): ${stderrData || "No stderr output"}`
        });
      } else {
        try {
          const results = JSON.parse(stdoutData);
          if (results.error) {
            res.status(400).json({ error: results.error });
          } else {
            res.json(results);
          }
        } catch (err) {
          console.error("Failed to parse simulation JSON output:", err);
          res.status(500).json({
            error: "Failed to parse simulation results from python script. Output was not valid JSON.",
            raw: stdoutData.substring(0, 500)
          });
        }
      }
    });

    // Write input JSON to python process stdin
    try {
      pythonProcess.stdin.write(JSON.stringify(req.body));
      pythonProcess.stdin.end();
    } catch (writeErr: any) {
      console.error("Failed to write to python stdin:", writeErr);
      res.status(500).json({ error: `Failed to invoke python process: ${writeErr?.message}` });
    }
  });

  // Vite middleware setup based on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("Error starting full-stack server:", err);
});
