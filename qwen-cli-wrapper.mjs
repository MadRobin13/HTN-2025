#!/usr/bin/env node

// This wrapper helps load the ES module qwen CLI from CommonJS environment
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and execute the qwen CLI
const qwenCliPath = join(__dirname, 'qwen-cli-bundle', 'gemini.js');
await import(qwenCliPath);