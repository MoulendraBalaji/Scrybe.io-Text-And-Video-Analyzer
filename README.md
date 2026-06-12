<div align="center">
  <h1>Scrybe 🎙️🧠</h1>
  <p><i>Engineering intelligent systems where ideas connect like synapses to create powerful AI-driven solutions.</i></p>
</div>

---

## 📖 About Scrybe

**Scrybe** is a breakthrough AI-driven application designed to evaluate video and audio responses against reference answers intelligently. By extracting media, performing high-fidelity transcription, generating frame-by-frame visual insights, and verifying semantic similarity, Scrybe's advanced ML pipeline gives instant, actionable feedback and highly predictable evaluation scores.

Whether you're practicing interview answers, pitching presentations, or assessing spoken assignments, Scrybe acts as your top-tier AI-powered evaluator.

**Status: 🟢 Whole Frontend and Backend Ready to Deploy**

## 🚀 AI Tools & Assistants Used

We utilized powerful AI tools in the development and creation of this website:
- **Antigravity (Google):** Utilized for deep system integration, rapid feature implementation, and extensive debugging across the full stack.
- **ChatGPT:** Leveraged for brainstorming architectural ideas, system design, and establishing the optimal application workflow.

## 🏗️ Core Workflow & New Features

1. **Upload & Input**: The user uploads a video/audio file and provides a reference/expected answer through the React frontend interface.
2. **API Communication**: The file and text are securely transmitted to the FastAPI backend via the `/evaluate` endpoint.
3. **Audio & Frame Extraction**: 
   - Uses `FFmpeg` to extract audio for transcription.
   - **NEW:** Uses `ffmpeg-python` to perform backend frame generation, extracting a representative video frame.
4. **Speech-to-Text Transcription**: The `OpenAI Whisper` model converts the captured audio into highly accurate text.
5. **Frame Analysis & Visual Comparison**: **NEW:** The captured frame is compared with the reference answer using `Google Gemini Vision`, providing constructive feedback on visual presence and body language relative to the topic.
6. **Advanced Similarity Refinement (`similarity_model.py`)**: 
   - **NEW:** Upgraded to train/calculate at higher score predictability using `all-mpnet-base-v2` and a hybrid metric approach. It measures both abstract semantic similarity and exact keyword overlap, making scoring extremely reliable.
7. **Feedback Generation**: LLMs (`Google Generative AI` / `OpenAI`) evaluate the transcript to generate descriptive structural summaries.
8. **Results Delivery**: The comprehensive evaluation, transcript, visual feedback, similarity scores, and grade are intuitively displayed to the user via the Vite/React frontend.

## 💻 Tech Stack

### Frontend
* **Core Framework**: [React 19](https://react.dev/)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **Styling**: Standard CSS (Glassmorphism & Gradients)
* **Other Tools**: jsPDF (for exporting Evaluation Reports)

### Backend
* **Core Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
* **Server**: Uvicorn

### Artificial Intelligence & Machine Learning
* **Speech-to-Text**: [OpenAI Whisper](https://github.com/openai/whisper)
* **Semantic Evaluation**: [Sentence-Transformers](https://sbert.net/) (`all-mpnet-base-v2`)
* **Generative & Vision Feedback**: `google-generativeai` (Gemini), `openai`
* **Core ML Libraries**: `torch`, `numpy`
* **Media Processing**: `ffmpeg-python` for Audio & Frame extraction

## 📂 Folder Structure

```text
The-Synapse-Squad/
│
├── Backend/                 # Python FastAPI server and ML Pipeline
│   ├── app.py               # Main application entry point & API routes
│   ├── requirements.txt     # Python dependencies definitions
│   ├── models/
│   │   └── similarity_model.py # Refined hybrid similarity evaluator
│   ├── pipeline/            # Core processing pipeline modules
│   │   ├── extract_audio.py # Audio separation logic
│   │   ├── extract_frames.py# Video frame generation logic
│   │   ├── speech_to_text.py# Whisper transcription
│   │   ├── text_cleaning.py # Formatting and cleaning
│   │   └── evaluator.py     # Main orchestration pipeline
│   └── utils/               # Helper ML utilities
│       ├── frame_analyzer.py# Visual comparison using Gemini
│       ├── feedback_generator.py # LLM integrations for descriptive feedback
│       ├── score_calculator.py   # Statistical/Math calculation helpers
│       └── summarizer.py         # Response digestion and summarization
│
└── Frontend/                # React Application User Interface
    ├── package.json         # Node dependencies and project scripts
    ├── vite.config.js       # Vite specifications
    ├── index.html           # Main entry HTML file
    └── src/                 # Source code (Components, Pages, Styles)
```

## 🛠️ Getting Started

### Prerequisites
* **Node.js**: v18+ for the Vite frontend environment.
* **Python**: v3.8+ for the backend configuration.
* **FFmpeg**: Must be installed on your system to extract media/frames.

### Backend Setup
1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```
2. Create and activate a Virtual Environment (Optional but recommended).
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Define your environment variables in a `.env` file (`OPENAI_API_KEY`, `GEMINI_API_KEY`).
5. Run the server:
   ```bash
   uvicorn app:app --reload
   ```
   *The server runs locally at `http://localhost:8000`.*

### Frontend Setup
1. Navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot up the Vite dev server:
   ```bash
   npm run dev
   ```

---
*Built with ❤️ by The-Synapse-Squad*
