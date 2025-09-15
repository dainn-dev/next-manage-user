from PIL import Image
import cv2
import torch
import math 
import function.utils_rotate as utils_rotate
from IPython.display import display
import os
import sys
import time
import argparse
import function.helper as helper
from function.json_handler import LicensePlateManager

# Add yolov5 to Python path for local model loading
yolov5_path = os.path.join(os.path.dirname(__file__), 'model', 'yolov5')
if yolov5_path not in sys.path:
    sys.path.insert(0, yolov5_path)

# Fix PyTorch 2.6 security issue with weights_only
try:
    import torch.serialization
    torch.serialization.add_safe_globals(['models.yolo.Model'])
    print("Added safe globals for YOLOv5 models")
except Exception as e:
    print(f"Warning: Could not add safe globals: {e}")

# load model
yolo_LP_detect = torch.hub.load('yolov5', 'custom', path='model/LP_detector_nano_61.pt', force_reload=True, source='local')
yolo_license_plate = torch.hub.load('yolov5', 'custom', path='model/LP_ocr_nano_62.pt', force_reload=True, source='local')
yolo_license_plate.conf = 0.60

# Initialize license plate manager
lp_manager = LicensePlateManager()

prev_frame_time = 0
new_frame_time = 0
last_saved_plates = set()  # Track recently saved plates to avoid duplicates

vid = cv2.VideoCapture(1)
# vid = cv2.VideoCapture("1.mp4")
while(True):
    ret, frame = vid.read()
    
    plates = yolo_LP_detect(frame, size=640)
    list_plates = plates.pandas().xyxy[0].values.tolist()
    list_read_plates = set()
    current_frame_plates = set()  # Track plates in current frame
    
    for plate in list_plates:
        flag = 0
        x = int(plate[0]) # xmin
        y = int(plate[1]) # ymin
        w = int(plate[2] - plate[0]) # xmax - xmin
        h = int(plate[3] - plate[1]) # ymax - ymin  
        crop_img = frame[y:y+h, x:x+w]
        cv2.rectangle(frame, (int(plate[0]),int(plate[1])), (int(plate[2]),int(plate[3])), color = (0,0,225), thickness = 2)
        cv2.imwrite("crop.jpg", crop_img)
        rc_image = cv2.imread("crop.jpg")
        lp = ""
        for cc in range(0,2):
            for ct in range(0,2):
                lp = helper.read_plate(yolo_license_plate, utils_rotate.deskew(crop_img, cc, ct))
                if lp != "unknown":
                    list_read_plates.add(lp)
                    current_frame_plates.add(lp)
                    cv2.putText(frame, lp, (int(plate[0]), int(plate[1]-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
                    flag = 1
                    break
            if flag == 1:
                break
    
    # Save new license plates to JSON (avoid duplicates in same session)
    for lp in current_frame_plates:
        if lp not in last_saved_plates:
            lp_manager.add_license_plate(lp)
            last_saved_plates.add(lp)
    
    # Update existing plates (if they appear again)
    for lp in current_frame_plates:
        if lp in last_saved_plates:
            # Check if enough time has passed to update output time
            lp_manager.add_license_plate(lp)
    new_frame_time = time.time()
    fps = 1/(new_frame_time-prev_frame_time)
    prev_frame_time = new_frame_time
    fps = int(fps)
    cv2.putText(frame, str(fps), (7, 70), cv2.FONT_HERSHEY_SIMPLEX, 3, (100, 255, 0), 3, cv2.LINE_AA)
    cv2.imshow('frame', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

vid.release()
cv2.destroyAllWindows()