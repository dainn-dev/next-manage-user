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

# Add ultralytics_yolov5_master to Python path for local model loading
yolov5_path = os.path.join(os.path.dirname(__file__), 'model', 'ultralytics_yolov5_master')
if yolov5_path not in sys.path:
    sys.path.insert(0, yolov5_path)

ap = argparse.ArgumentParser()
ap.add_argument('-i', '--image', required=True, help='path to input image')
args = ap.parse_args()

import torch

# Fix PyTorch 2.6 security issue with weights_only
try:
    import torch.serialization
    torch.serialization.add_safe_globals(['models.yolo.Model'])
    print("Added safe globals for YOLOv5 models")
except Exception as e:
    print(f"Warning: Could not add safe globals: {e}")

# Load models using torch.hub with local ultralytics_yolov5_master source
yolo_LP_detect = torch.hub.load(yolov5_path, 'custom', path='model/LP_detector.pt', force_reload=True, source='local')
yolo_license_plate = torch.hub.load(yolov5_path, 'custom', path='model/LP_ocr.pt', force_reload=True, source='local')
yolo_license_plate.conf = 0.60

# Initialize license plate manager
lp_manager = LicensePlateManager()

img = cv2.imread(args.image)
plates = yolo_LP_detect(img, size=640)

plates = yolo_LP_detect(img, size=640)
list_plates = plates.pandas().xyxy[0].values.tolist()
list_read_plates = set()
detected_plates = set()  # Track all detected plates in this image

if len(list_plates) == 0:
    lp = helper.read_plate(yolo_license_plate,img)
    if lp != "unknown":
        cv2.putText(img, lp, (7, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
        list_read_plates.add(lp)
        detected_plates.add(lp)
else:
    for plate in list_plates:
        flag = 0
        x = int(plate[0]) # xmin
        y = int(plate[1]) # ymin
        w = int(plate[2] - plate[0]) # xmax - xmin
        h = int(plate[3] - plate[1]) # ymax - ymin  
        crop_img = img[y:y+h, x:x+w]
        cv2.rectangle(img, (int(plate[0]),int(plate[1])), (int(plate[2]),int(plate[3])), color = (0,0,225), thickness = 2)
        cv2.imwrite("crop.jpg", crop_img)
        rc_image = cv2.imread("crop.jpg")
        lp = ""
        for cc in range(0,2):
            for ct in range(0,2):
                lp = helper.read_plate(yolo_license_plate, utils_rotate.deskew(crop_img, cc, ct))
                if lp != "unknown":
                    list_read_plates.add(lp)
                    detected_plates.add(lp)
                    cv2.putText(img, lp, (int(plate[0]), int(plate[1]-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
                    flag = 1
                    break
            if flag == 1:
                break

# Save all detected license plates to JSON
for lp in detected_plates:
    lp_manager.add_license_plate(lp)
cv2.imshow('frame', img)
cv2.waitKey()
cv2.destroyAllWindows()