import math
import re
from typing import Optional, Tuple

import cv2
import numpy as np

from config_manager import config_manager

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    import easyocr
except ImportError:
    easyocr = None

_easyocr_reader = None

# license plate type classification helper function
def linear_equation(x1, y1, x2, y2):
    b = y1 - (y2 - y1) * x1 / (x2 - x1)
    a = (y1 - b) / x1
    return a, b

def check_point_linear(x, y, x1, y1, x2, y2):
    a, b = linear_equation(x1, y1, x2, y2)
    y_pred = a*x+b
    return(math.isclose(y_pred, y, abs_tol = 3))

# detect character and number in license plate
def read_plate(yolo_license_plate, im):
    LP_type = "1"
    results = yolo_license_plate(im)
    bb_list = results.pandas().xyxy[0].values.tolist()
    # Support various license plate formats including Vietnam 5-number plates
    # Original: 7-10 characters, Updated: 5-10 characters to support Vietnam format
    if len(bb_list) == 0 or len(bb_list) < 5 or len(bb_list) > 10:
        return "unknown"
    center_list = []
    y_mean = 0
    y_sum = 0
    for bb in bb_list:
        x_c = (bb[0]+bb[2])/2
        y_c = (bb[1]+bb[3])/2
        y_sum += y_c
        center_list.append([x_c,y_c,bb[-1]])

    # find 2 point to draw line
    l_point = center_list[0]
    r_point = center_list[0]
    for cp in center_list:
        if cp[0] < l_point[0]:
            l_point = cp
        if cp[0] > r_point[0]:
            r_point = cp
    for ct in center_list:
        if l_point[0] != r_point[0]:
            if (check_point_linear(ct[0], ct[1], l_point[0], l_point[1], r_point[0], r_point[1]) == False):
                LP_type = "2"

    y_mean = int(int(y_sum) / len(bb_list))
    size = results.pandas().s

    # 1 line plates and 2 line plates
    line_1 = []
    line_2 = []
    license_plate = ""
    if LP_type == "2":
        for c in center_list:
            if int(c[1]) > y_mean:
                line_2.append(c)
            else:
                line_1.append(c)
        
        # Sort both lines by x-coordinate
        line_1_sorted = sorted(line_1, key = lambda x: x[0])
        line_2_sorted = sorted(line_2, key = lambda x: x[0])
        
        # Build strings for both lines
        line_1_text = ""
        line_2_text = ""
        for l1 in line_1_sorted:
            line_1_text += str(l1[2])
        for l2 in line_2_sorted:
            line_2_text += str(l2[2])
        
        # Determine correct order based on Vietnamese license plate format
        # Vietnamese plates typically have letters first (like 64A) then numbers (like 040.75)
        # Check if line_1 contains letters and line_2 contains numbers, or vice versa
        line_1_has_letters = any(c.isalpha() for c in line_1_text)
        line_2_has_letters = any(c.isalpha() for c in line_2_text)
        
        print(f"DEBUG: Line 1: '{line_1_text}' (has letters: {line_1_has_letters})")
        print(f"DEBUG: Line 2: '{line_2_text}' (has letters: {line_2_has_letters})")
        
        if line_1_has_letters and not line_2_has_letters:
            # Line 1 has letters, line 2 has numbers - correct order
            license_plate = line_1_text + "-" + line_2_text
            print(f"DEBUG: Using normal order: {license_plate}")
        elif line_2_has_letters and not line_1_has_letters:
            # Line 2 has letters, line 1 has numbers - reverse order
            license_plate = line_2_text + "-" + line_1_text
            print(f"DEBUG: Using reversed order: {license_plate}")
        else:
            # Both lines have mixed content or unclear - use original logic
            license_plate = line_1_text + "-" + line_2_text
            print(f"DEBUG: Using original logic: {license_plate}")
    else:
        for l in sorted(center_list, key = lambda x: x[0]):
            license_plate += str(l[2])
    return license_plate


def _extract_red_plate_region(image):
    """Locate red-background plate region and return crop plus bounding box."""
    try:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    except Exception:
        return None, None, None

    # Red spans two ranges in HSV
    lower_red1 = np.array([0, 70, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 70, 50])
    upper_red2 = np.array([180, 255, 255])

    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask = cv2.bitwise_or(mask1, mask2)

    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, None, None

    height, width = image.shape[:2]
    image_area = float(height * width)

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < 2500:
            continue
        if image_area > 0 and (area / image_area) > 0.5:
            # Too large, likely entire frame
            continue

        x, y, w, h = cv2.boundingRect(contour)
        if w == 0 or h == 0:
            continue

        aspect = w / float(h)
        if aspect < 1.1 or aspect > 4.5:
            continue

        fill_ratio = area / float(w * h)
        if fill_ratio < 0.4:
            continue

        pad_w = int(w * 0.08)
        pad_h = int(h * 0.08)
        x0 = max(x - pad_w, 0)
        y0 = max(y - pad_h, 0)
        x1 = min(x + w + pad_w, width)
        y1 = min(y + h + pad_h, height)

        crop = image[y0:y1, x0:x1]
        bbox = (x0, y0, x1, y1)

        # Also compute polygon points for overlays if needed
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        polygon = approx.reshape(-1, 2).tolist() if len(approx) >= 4 else None

        return crop, bbox, polygon

    return None, None, None


def _ensure_tesseract_configured():
    if pytesseract is None:
        return

    custom_cmd = config_manager.get_ocr_tesseract_cmd()
    if custom_cmd:
        pytesseract.pytesseract.tesseract_cmd = custom_cmd


def read_plate_with_tesseract(image):
    """
    Fallback OCR using Tesseract for non-standard plates such as red-background variants.
    """
    if pytesseract is None:
        return "unknown", None, None
    try:
        _ensure_tesseract_configured()
        region, bbox, polygon = _extract_red_plate_region(image)
        if region is None:
            return "unknown", None, None

        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        # Adaptive threshold works better for varying lighting / shadows
        thresh = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            31,
            7,
        )

        kernel = np.ones((3, 3), np.uint8)
        processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)

        config = "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
        text = pytesseract.image_to_string(processed, config=config)
        cleaned = re.sub(r"[^A-Z0-9-]", "", text.upper())

        # Typical Vietnamese temporary plate like TC33-86 (4+ chars, contains digits)
        if len(cleaned) >= 4 and any(ch.isdigit() for ch in cleaned):
            return cleaned, bbox, polygon

        return "unknown", None, None
    except Exception as exc:
        print(f"Tesseract fallback error: {exc}")
        return "unknown", None, None


def _get_easyocr_reader():
    global _easyocr_reader
    if easyocr is None:
        return None

    if _easyocr_reader is not None:
        return _easyocr_reader

    try:
        languages = config_manager.get_easyocr_languages()
        if isinstance(languages, str):
            languages = [lang.strip() for lang in languages.split(',') if lang.strip()]
        use_gpu = config_manager.get_easyocr_gpu()
        _easyocr_reader = easyocr.Reader(languages or ['en'], gpu=use_gpu)
    except Exception as exc:
        print(f"EasyOCR initialization error: {exc}")
        _easyocr_reader = None
    return _easyocr_reader


def read_plate_with_easyocr(image):
    reader = _get_easyocr_reader()
    if reader is None:
        return "unknown", None, None

    try:
        region, bbox, polygon = _extract_red_plate_region(image)
        if region is None:
            return "unknown", None, None

        results = reader.readtext(region)
        if not results:
            return "unknown", None, None

        min_conf = config_manager.get_easyocr_min_confidence()
        texts = []
        for _, text, conf in results:
            if conf >= min_conf:
                cleaned = re.sub(r"[^A-Z0-9-]", "", text.upper())
                if cleaned:
                    texts.append(cleaned)

        candidate = "".join(texts)
        if len(candidate) >= 4 and any(ch.isdigit() for ch in candidate):
            return candidate, bbox, polygon

        return "unknown", None, None
    except Exception as exc:
        print(f"EasyOCR fallback error: {exc}")
        return "unknown", None, None


def read_plate_with_fallback(image) -> Tuple[str, Optional[str], Optional[Tuple[int, int, int, int]], Optional[list]]:
    """Route to configured fallback OCR and return plate text, method name, bbox, and polygon."""
    if not config_manager.get_ocr_fallback_enabled():
        return "unknown", None, None, None

    method = config_manager.get_ocr_fallback_method().lower()

    if method == "easyocr":
        result, bbox, polygon = read_plate_with_easyocr(image)
        return result, "EASYOCR" if result != "unknown" else None, bbox, polygon

    # Default to Tesseract
    result, bbox, polygon = read_plate_with_tesseract(image)
    return result, "TESSERACT" if result != "unknown" else None, bbox, polygon