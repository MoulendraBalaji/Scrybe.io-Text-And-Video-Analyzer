import whisper
import os
import datetime
from dotenv import load_dotenv

# Load environment variables (useful for HF_TOKEN)
load_dotenv()

# Lazy loading of models to avoid overhead and errors during import
_whisper_model = None
_diarization_pipeline = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Whisper model (base)...")
        _whisper_model = whisper.load_model("base")
    return _whisper_model

def get_diarization_pipeline():
    global _diarization_pipeline
    if _diarization_pipeline is None:
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token or hf_token == "YOUR_HF_TOKEN":
            print("Warning: HF_TOKEN not found or is placeholder. Skipping diarization.")
            return None
        
        try:
            from pyannote.audio import Pipeline
            print("Loading pyannote diarization pipeline...")
            _diarization_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token
            )
        except Exception as e:
            print(f"Error loading diarization pipeline: {e}")
            _diarization_pipeline = None
            
    return _diarization_pipeline

def transcribe_audio(audio_file):
    """
    Transcribes audio and optionally performs diarization.
    Returns the transcript as a string.
    """
    if not os.path.exists(audio_file):
        raise FileNotFoundError(f"Audio file not found: {audio_file}")

    # 1. Perform Transcription
    model = get_whisper_model()
    print(f"Transcribing {audio_file}...")
    result = model.transcribe(audio_file, verbose=False)
    
    # 2. Try Diarization if possible
    pipeline = get_diarization_pipeline()
    if pipeline:
        try:
            print("Diarizing speakers...")
            diarization = pipeline(audio_file)
            segments = result['segments']
            
            conversation = []
            for segment in segments:
                start = segment['start']
                end = segment['end']
                text = segment['text'].strip()
                
                best_speaker = "Unknown"
                max_overlap = 0
                
                for turn, _, speaker in diarization.itertracks(yield_label=True):
                    overlap = max(0, min(end, turn.end) - max(start, turn.start))
                    if overlap > max_overlap:
                        max_overlap = overlap
                        best_speaker = speaker
                
                timestamp = str(datetime.timedelta(seconds=int(start)))
                conversation.append(f"[{timestamp}] {best_speaker}: {text}")
            
            return "\n".join(conversation)
        except Exception as e:
            print(f"Diarization failed, falling back to plain transcription: {e}")
            return result['text'].strip()
    
    # Fallback to plain text
    return result['text'].strip()

# Compatibility alias for generate_conversation if needed
def generate_conversation(audio_file):
    return transcribe_audio(audio_file)

if __name__ == "__main__":
    import sys
    # Example execution: python speech_to_text.py your_audio.wav
    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
    else:
        # Check if a default test file exists in uploads/audio (assuming one might be there)
        audio_path = "test_audio.wav"
        
    if os.path.exists(audio_path):
        transcript = transcribe_audio(audio_path)
        print("\n--- TRANSCRIPT ---\n")
        print(transcript)
    else:
        print(f"Usage: python speech_to_text.py <path_to_audio_file>")
        print(f"Target file '{audio_path}' not found.")
