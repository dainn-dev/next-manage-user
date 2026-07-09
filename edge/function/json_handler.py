import json
import os
from datetime import datetime
import tkinter as tk
from tkinter import messagebox

class LicensePlateManager:
    def __init__(self, json_file_path="license_plates.json"):
        self.json_file_path = json_file_path
        self.data = self.load_data()
    
    def load_data(self):
        """Load data from JSON file, create file if it doesn't exist"""
        if os.path.exists(self.json_file_path):
            try:
                with open(self.json_file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                return []
        else:
            return []
    
    def save_data(self):
        """Save data to JSON file"""
        try:
            with open(self.json_file_path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving data: {e}")
            return False
    
    def add_license_plate(self, license_plate_number):
        """Add or update license plate entry"""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Check if license plate already exists
        existing_entry = None
        for entry in self.data:
            if entry.get('licensePlateNumber') == license_plate_number:
                existing_entry = entry
                break
        
        if existing_entry:
            # Update existing entry with new output time
            existing_entry['outputTime'] = current_time
            success = self.save_data()
            # if success:
            #     self.show_success_popup(f"License plate {license_plate_number} updated successfully!")
            return success
        else:
            # Add new entry
            new_entry = {
                "licensePlateNumber": license_plate_number,
                "inputTime": current_time,
                "outputTime": current_time
            }
            self.data.append(new_entry)
            success = self.save_data()
            # if success:
            #     self.show_success_popup(f"License plate {license_plate_number} saved successfully!")
            return success
    
    def show_success_popup(self, message):
        """Show success popup message"""
        try:
            # Create a root window (hidden)
            root = tk.Tk()
            root.withdraw()  # Hide the main window
            
            # Show message box
            messagebox.showinfo("Success", message)
            
            # Destroy the root window
            root.destroy()
        except Exception as e:
            print(f"Error showing popup: {e}")
            print(f"Success: {message}")
    
    def get_all_plates(self):
        """Get all license plate entries"""
        return self.data
    
    def search_plate(self, license_plate_number):
        """Search for a specific license plate"""
        for entry in self.data:
            if entry.get('licensePlateNumber') == license_plate_number:
                return entry
        return None
