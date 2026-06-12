const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
const zipPath = path.join(__dirname, "ffmpeg.zip");

console.log("Downloading FFmpeg...");
execSync(`curl -L -o ffmpeg.zip "${url}"`, { stdio: "inherit" });

console.log("Extracting FFmpeg...");
execSync(`powershell -command "Expand-Archive -Path ffmpeg.zip -DestinationPath ffmpeg_extracted -Force"`, { stdio: "inherit" });

const extractedExe = path.join(__dirname, "ffmpeg_extracted", "ffmpeg-7.1-essentials_build", "bin", "ffmpeg.exe");
const targetExe = path.join(__dirname, "bin", "ffmpeg.exe");

if (!fs.existsSync(path.join(__dirname, "bin"))) {
  fs.mkdirSync(path.join(__dirname, "bin"));
}

fs.copyFileSync(extractedExe, targetExe);
console.log("Copied to bin/ffmpeg.exe");

// cleanup
fs.rmSync(zipPath);
fs.rmSync(path.join(__dirname, "ffmpeg_extracted"), { recursive: true, force: true });
console.log("Done");
