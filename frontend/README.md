# MRIIQ — Frontend Application

Next.js 16 + React 19 Frontend for the **MRIIQ Prior Authorization Intelligence System**.

For complete system documentation, architecture diagrams, LangGraph state workflows, and agent specifications, see the root [README.md](../README.md).

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run production build
npm run build
```

Open [http://localhost:3000](http://localhost:3000) or [http://mriiq.fit:3000](http://mriiq.fit:3000).

## Features
- **SOAP Notes Viewer & Clinical RAG Assistant**: Query physician documentation with section citations (`[S]`, `[O]`, `[A]`, `[P]`).
- **Universal Speech Engine**: Seamless OpenAI TTS (`tts-1-hd` / `onyx`) with automatic Web Speech API fallback.
- **Embedded PDF Viewer**: Live preview of official clinical SOAP PDFs.
- **Human-in-the-Loop Review**: Clinical reviewer actions with state resumption.
