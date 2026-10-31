import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const services = [
  { name: "Auth Service", dir: "services/auth-service", port: 5001 },
  { name: "Event Service", dir: "services/event-service", port: 5002 },
  { name: "Booking Service", dir: "services/booking-service", port: 5003 },
  { name: "Payment Service", dir: "services/payment-service", port: 5004 },
  { name: "Ticket Service", dir: "services/ticket-service", port: 5005 },
  { name: "API Gateway", dir: "api-gateway", port: 5000 },
];

const processes = [];

console.log("======================================================================");
console.log("Launching ShowTime Microservices Suite...");
console.log("======================================================================");

for (const svc of services) {
  const p = spawn("node", ["server.js"], {
    cwd: path.join(ROOT, svc.dir),
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, PORT: svc.port },
  });

  p.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line) console.log(`[${svc.name}:${svc.port}] ${line}`);
  });

  p.stderr.on("data", (data) => {
    const line = data.toString().trim();
    if (line) console.error(`[${svc.name}:${svc.port} ERR] ${line}`);
  });

  p.on("exit", (code) => {
    console.log(`[${svc.name}] Exited with code ${code}`);
  });

  processes.push(p);
}

function shutdown() {
  console.log("\nStopping all microservices...");
  for (const p of processes) {
    try {
      p.kill("SIGTERM");
    } catch (_) {}
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

