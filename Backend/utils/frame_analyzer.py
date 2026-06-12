import cv2
import os

def compare_frame_with_reference(frame_path, reference_answer):
    if not frame_path or not os.path.exists(frame_path):
        return "Frame analysis is unavailable."

    try:
        # Load the image
        img = cv2.imread(frame_path)
        if img is None:
            return "Unable to read the video frame."
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Load the pre-trained face cascade
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) > 0:
            return f"Visual Analysis: Detected {len(faces)} face(s). Candidate maintains visual presence in the frame."
        else:
            return "Visual Analysis: No face clearly detected in the representative frame. Good lighting and positioning are recommended."
            
    except Exception as e:
        print(f"Frame Analysis Error: {e}")
        return "Unable to analyze the video frame visually."
