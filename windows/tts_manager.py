#!/usr/bin/env python3
"""
Text-to-Speech Manager for Vietnamese Language
Handles TTS functionality for license plate monitoring system
"""

import pyttsx3
import threading
import time
from gtts import gTTS
import pygame
import io
import os
from config_manager import config_manager


class TTSManager:
    """Text-to-Speech Manager with Vietnamese language support"""
    
    def __init__(self):
        self.engine = None
        self.is_speaking = False
        self.speech_queue = []
        self.current_thread = None
        self.should_stop = False  # Flag to stop speech
        self.initialize_engine()
    
    def initialize_engine(self):
        """Initialize the TTS engine"""
        try:
            # Initialize pyttsx3 engine
            self.engine = pyttsx3.init()
            
            # Get available voices
            voices = self.engine.getProperty('voices')
            
            # Try to find Vietnamese voice (if available)
            vietnamese_voice = None
            for voice in voices:
                if 'vietnamese' in voice.name.lower() or 'viet' in voice.name.lower():
                    vietnamese_voice = voice
                    break
            
            if vietnamese_voice:
                self.engine.setProperty('voice', vietnamese_voice.id)
                print(f"Using Vietnamese voice: {vietnamese_voice.name}")
            else:
                # Use default voice
                print("Vietnamese voice not found, using default voice")
            
            # Set speech rate and volume
            self.engine.setProperty('rate', config_manager.get('tts.rate', 150))
            self.engine.setProperty('volume', config_manager.get('tts.volume', 0.8))
            
        except Exception as e:
            print(f"Error initializing TTS engine: {e}")
            self.engine = None
    
    def speak_text(self, text, use_gtts=True):
        """Speak the given text in Vietnamese"""
        if not text or not text.strip() or self.should_stop:
            return
        
        try:
            if use_gtts:
                try:
                    if not self.should_stop:
                        self.speak_with_gtts(text)
                except Exception as gtts_error:
                    print(f"Google TTS failed: {gtts_error}")
                    print("Falling back to pyttsx3 (English voice)")
                    if not self.should_stop:
                        self.speak_with_pyttsx3(text)
            else:
                if not self.should_stop:
                    self.speak_with_pyttsx3(text)
        except Exception as e:
            print(f"Error speaking text: {e}")
    
    def speak_with_gtts(self, text):
        """Use Google Text-to-Speech for Vietnamese"""
        try:
            print(f"Using Google TTS for Vietnamese: {text}")
            # Create gTTS object for Vietnamese
            tts = gTTS(text=text, lang='vi', slow=False)
            
            # Save to temporary file
            temp_file = "temp_speech.mp3"
            tts.save(temp_file)
            
            # Play the audio
            pygame.mixer.init()
            pygame.mixer.music.load(temp_file)
            pygame.mixer.music.play()
            
            # Wait for playback to finish (with stop check)
            while pygame.mixer.music.get_busy() and not self.should_stop:
                time.sleep(0.1)
            
            # Clean up
            pygame.mixer.quit()
            if os.path.exists(temp_file):
                os.remove(temp_file)
            
            if not self.should_stop:
                print("Google TTS completed successfully")
            else:
                print("Google TTS stopped by user")
                
        except Exception as e:
            print(f"Error with gTTS: {e}")
            print("Google TTS failed - this will result in English voice")
            # Don't fallback to pyttsx3 automatically - let user know
            raise Exception(f"Google TTS failed: {e}. Please check internet connection.")
    
    def speak_with_pyttsx3(self, text):
        """Use pyttsx3 for text-to-speech"""
        if not self.engine or self.should_stop:
            print("TTS engine not available or stop requested")
            return
        
        try:
            print(f"Using pyttsx3 (English voice): {text}")
            self.engine.say(text)
            
            # Use runAndWait with timeout and stop checks
            start_time = time.time()
            timeout = 10  # 10 second timeout
            
            # Start the speech
            self.engine.startLoop(False)
            
            # Wait for completion with stop checks
            while self.engine.isBusy() and not self.should_stop:
                if time.time() - start_time > timeout:
                    print("pyttsx3 timeout - stopping")
                    break
                time.sleep(0.1)
            
            # Stop the engine
            self.engine.endLoop()
            
            if not self.should_stop:
                print("pyttsx3 completed successfully")
            else:
                print("pyttsx3 stopped by user")
        except Exception as e:
            print(f"Error with pyttsx3: {e}")
    
    def speak_async(self, text, use_gtts=True):
        """Speak text asynchronously to avoid blocking UI"""
        if self.current_thread and self.current_thread.is_alive():
            # If already speaking, add to queue
            self.speech_queue.append((text, use_gtts))
            return
        
        self.current_thread = threading.Thread(
            target=self._speak_thread, 
            args=(text, use_gtts)
        )
        self.current_thread.daemon = True
        self.current_thread.start()
    
    def _speak_thread(self, text, use_gtts):
        """Thread function for speaking"""
        try:
            self.is_speaking = True
            # Don't reset should_stop flag here - let it be controlled externally
            
            # Check if we should stop before speaking
            if not self.should_stop:
                self.speak_text(text, use_gtts)
            
            # Process queue with frequent stop checks
            while self.speech_queue and not self.should_stop:
                queued_text, queued_use_gtts = self.speech_queue.pop(0)
                if not self.should_stop:
                    self.speak_text(queued_text, queued_use_gtts)
                else:
                    break  # Exit immediately if stop is requested
                
        except Exception as e:
            print(f"Error in speech thread: {e}")
        finally:
            self.is_speaking = False
    
    def stop_speaking(self):
        """Stop current speech and clear queue"""
        try:
            print("Stopping all TTS speech...")
            
            # Set stop flag first to prevent new operations
            self.should_stop = True
            
            # Stop pyttsx3 engine immediately
            if self.engine:
                try:
                    self.engine.stop()
                    # Also try to end the current utterance
                    self.engine.endLoop()
                    print("Stopped pyttsx3 engine")
                except Exception as e:
                    print(f"Error stopping pyttsx3: {e}")
            
            # Stop pygame mixer (for Google TTS) immediately
            try:
                pygame.mixer.music.stop()
                pygame.mixer.quit()
                # Reinitialize mixer to ensure clean state
                pygame.mixer.init()
                print("Stopped pygame mixer")
            except Exception as e:
                print(f"Error stopping pygame mixer: {e}")
            
            # Clear queue immediately
            self.speech_queue.clear()
            self.is_speaking = False
            
            # Force stop any running threads
            if self.current_thread and self.current_thread.is_alive():
                print("Speech thread is running - will stop when it checks should_stop flag")
            
            print("All TTS stopped successfully")
            
        except Exception as e:
            print(f"Error stopping speech: {e}")
            # Ensure flags are set even if there's an error
            self.should_stop = True
            self.is_speaking = False
    
    def speak_license_plate_response(self, license_plate, panel_type, response_data):
        """Speak license plate detection response in Vietnamese"""
        try:
            # Check if TTS is enabled
            if not config_manager.get_tts_enabled():
                print("TTS is disabled in configuration")
                return
            
            # Create Vietnamese message
            if response_data.get("success", False):
                if response_data.get("cached", False):
                    message = f"Biển số xe {license_plate} đã được phát hiện trước đó tại cổng {panel_type}"
                else:
                    message = f"Phát hiện biển số xe {license_plate} tại cổng {panel_type}. {response_data.get('message', 'Thành công')}"
            else:
                message = f"Lỗi khi xử lý biển số xe {license_plate} tại cổng {panel_type}. {response_data.get('message', 'Có lỗi xảy ra')}"
            
            # Use configuration to determine TTS method
            use_gtts = config_manager.get_tts_use_gtts()
            print(f"Speaking message with {'Google TTS' if use_gtts else 'pyttsx3'}: {message}")
            
            # Speak the message
            self.speak_async(message, use_gtts=use_gtts)
            
        except Exception as e:
            print(f"Error speaking license plate response: {e}")
    
    def speak_simple_message(self, message):
        """Speak a simple message in Vietnamese"""
        use_gtts = config_manager.get_tts_use_gtts()
        self.speak_async(message, use_gtts=use_gtts)
    
    def set_voice_properties(self, rate=None, volume=None):
        """Set voice properties"""
        if not self.engine:
            return
        
        try:
            if rate is not None:
                self.engine.setProperty('rate', rate)
                config_manager.set('tts.rate', rate)
            
            if volume is not None:
                self.engine.setProperty('volume', volume)
                config_manager.set('tts.volume', volume)
                
        except Exception as e:
            print(f"Error setting voice properties: {e}")


# Global TTS manager instance
tts_manager = TTSManager()
