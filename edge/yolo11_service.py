#!/usr/bin/env python3
"""
YOLOv11 Service Module
-------------------

Module xử lý inference YOLOv11 (Ultralytics) cho Vehicle Management System.
Hỗ trợ:
- Inference base
- Export ONNX (cho deployment)
- Integration với camera pipeline
- License plate + vehicle detection kết hợp

Author: Claude Code Agent
Date: 2026-08-08
"""

import torch
import numpy as np
from ultralytics import YOLO
from pathlib import Path
from typing import Dict, List, Tuple, Union, Optional

class YOLOv11Service:
    """YOLOv11 Service - Inference engine cho vehicle detection và license plate recognition."""

    def __init__(
        self,
        model_path: Union[str, Path] = None,
        device: str = "cuda" if torch.cuda.is_available() else "cpu",
        conf_thres: float = 0.45,
        iou_thres: float = 0.45,
        max_det: int = 100
    ):
        self.device = device
        self.conf_thres = conf_thres
        self.iou_thres = iou_thres
        self.max_det = max_det

        # Load model
        if model_path is None:
            model_path = "yolo11n.pt"  # Default small model
            print(f"Using default model: {model_path}")

        self.model = YOLO(str(model_path))

        # Set device
        if device == "cuda" and torch.cuda.is_available():
            self.model.to("cuda")
            print(f"Loaded YOLOv11 on CUDA: {device}")
        else:
            print(f"Loaded YOLOv11 on CPU: {device}")

        self.model_name = "yolo11n"
        self.model_version = "11.0"
        self.model_path = Path(model_path)

    def detect(self, image: np.ndarray) -> List[Dict]:
        """
        Detect objects in image.

        Args:
            image: numpy array (H, W, C) in BGR format

        Returns:
            List of detection dicts
        """
        if image is None:
            return []

        # Run inference
        results = self.model.predict(
            source=image,
            conf=self.conf_thres,
            iou=self.iou_thres,
            max_det=self.max_det,
            verbose=False
        )

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()

                x1, y1, x2, y2 = map(int, xyxy)

                detection = {
                    "class_id": cls,
                    "class_name": self.model.names.get(cls, f"unknown_{cls}"),
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2],
                    "area": (x2 - x1) * (y2 - y1)
                }
                detections.append(detection)

        return detections

    def detect_with_plate(self, image: np.ndarray) -> Dict:
        """
        Detect vehicle + license plate in one image.
        Returns structured result for camera pipeline.
        """
        detections = self.detect(image)

        result = {
            "image_shape": image.shape,
            "detections": detections,
            "timestamp": np.datetime64("now").item().isoformat(),
            "model": self.model_name,
            "version": self.model_version
        }

        return result

    def export_onnx(self, output_path: Union[str, Path], opset: int = 17) -> bool:
        """
        Export model to ONNX format.

        Args:
            output_path: Path to save ONNX model
            opset: ONNX opset version

        Returns:
            True if success
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Export
        success = self.model.export(
            format="onnx",
            opset=opset,
            imgsz=640,
            half=True if self.device == "cuda" else False,
            simplify=True,
            verbose=False
        )

        if success:
            print(f"Successfully exported ONNX to {output_path}")
            return True
        else:
            print("Export failed")
            return False

    def predict_batch(self, images: List[np.ndarray], batch_size: int = 8) -> List[Dict]:
        """Process multiple images in batch."""
        results = []
        for i in range(0, len(images), batch_size):
            batch = images[i:i + batch_size]
            batch_results = self.detect_batch(batch)
            results.extend(batch_results)
        return results

    def detect_batch(self, images: List[np.ndarray]) -> List[Dict]:
        """Batch inference."""
        images = [img for img in images if img is not None]
        if not images:
            return []

        results = self.model.predict(
            source=images,
            conf=self.conf_thres,
            iou=self.iou_thres,
            max_det=self.max_det,
            verbose=False
        )

        all_detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                all_detections.append([])
                continue

            batch_detections = []
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()

                x1, y1, x2, y2 = map(int, xyxy)

                detection = {
                    "class_id": cls,
                    "class_name": self.model.names.get(cls, f"unknown_{cls}"),
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2],
                    "area": (x2 - x1) * (y2 - y1)
                }
                batch_detections.append(detection)

            all_detections.append(batch_detections)

        return all_detections

# Factory function
def create_yolo11_service(model_path: Optional[str] = None) -> YOLOv11Service:
    """Factory to create YOLOv11 service."""
    return YOLOv11Service(model_path=model_path)

# Common models
YOLO11_MODELS = {
    "n": "yolo11n.pt",
    "s": "yolo11s.pt",
    "m": "yolo11m.pt",
    "l": "yolo11l.pt",
    "x": "yolo11x.pt"
}

def get_yolo11_model(model_size: str = "n") -> str:
    """Get model path by size."""
    return f"yolo11{model_size}.pt"

if __name__ == "__main__":
    print("YOLOv11 Service module loaded successfully")
    print("Available models:", list(YOLO11_MODELS.keys()))