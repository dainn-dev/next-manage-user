package com.vehiclemanagement.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class ImageProcessingUtilTest {
    
    private final ImageProcessingUtil imageProcessingUtil = new ImageProcessingUtil();
    
    @Test
    void testValidImageFile() {
        // Create a mock image file
        byte[] imageData = createMockImageData();
        MultipartFile imageFile = new MockMultipartFile(
                "image", 
                "test.jpg", 
                "image/jpeg", 
                imageData
        );
        
        assertTrue(imageProcessingUtil.isValidImage(imageFile));
    }
    
    @Test
    void testInvalidImageFile() {
        // Create a mock non-image file
        byte[] textData = "This is not an image".getBytes();
        MultipartFile textFile = new MockMultipartFile(
                "file", 
                "test.txt", 
                "text/plain", 
                textData
        );
        
        assertFalse(imageProcessingUtil.isValidImage(textFile));
    }
    
    @Test
    void testNullImageFile() {
        assertFalse(imageProcessingUtil.isValidImage(null));
    }
    
    @Test
    void testEmptyImageFile() {
        MultipartFile emptyFile = new MockMultipartFile(
                "image", 
                "empty.jpg", 
                "image/jpeg", 
                new byte[0]
        );
        
        assertFalse(imageProcessingUtil.isValidImage(emptyFile));
    }
    
    @Test
    void testProcessImageWithValidFile() throws IOException {
        // Create a mock image file
        byte[] imageData = createMockImageData();
        MultipartFile imageFile = new MockMultipartFile(
                "image", 
                "test.jpg", 
                "image/jpeg", 
                imageData
        );
        
        byte[] processedData = imageProcessingUtil.processImage(imageFile);
        
        assertNotNull(processedData);
        assertTrue(processedData.length > 0);
    }
    
    @Test
    void testProcessImageWithNullFile() {
        assertThrows(IllegalArgumentException.class, () -> {
            imageProcessingUtil.processImage(null);
        });
    }
    
    @Test
    void testProcessImageWithEmptyFile() {
        MultipartFile emptyFile = new MockMultipartFile(
                "image", 
                "empty.jpg", 
                "image/jpeg", 
                new byte[0]
        );
        
        assertThrows(IllegalArgumentException.class, () -> {
            imageProcessingUtil.processImage(emptyFile);
        });
    }
    
    @Test
    void testGetProcessedImageExtension() {
        assertEquals("jpg", imageProcessingUtil.getProcessedImageExtension());
    }
    
    /**
     * Create mock image data (minimal JPEG header)
     */
    private byte[] createMockImageData() {
        // Minimal JPEG header (just enough to be recognized as an image)
        return new byte[]{
                (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, // JPEG SOI + APP0
                0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, // JFIF header
                0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
                (byte) 0xFF, (byte) 0xD9 // JPEG EOI
        };
    }
}
