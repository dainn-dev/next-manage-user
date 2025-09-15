package com.vehiclemanagement.util;

import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

@Component
public class ImageProcessingUtil {
    
    private static final int MAX_WIDTH = 1920;
    private static final int MAX_HEIGHT = 1080;
    private static final float QUALITY = 0.85f;
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    
    /**
     * Process and optimize an image for upload
     * @param imageFile The original image file
     * @return Processed image as byte array
     * @throws IOException if processing fails
     */
    public byte[] processImage(MultipartFile imageFile) throws IOException {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new IllegalArgumentException("Image file is null or empty");
        }
        
        // If file is already small enough, return as-is
        if (imageFile.getSize() <= MAX_FILE_SIZE) {
            return imageFile.getBytes();
        }
        
        try (InputStream inputStream = new ByteArrayInputStream(imageFile.getBytes())) {
            BufferedImage originalImage = ImageIO.read(inputStream);
            
            if (originalImage == null) {
                throw new IOException("Unable to read image file");
            }
            
            // Calculate new dimensions while maintaining aspect ratio
            int originalWidth = originalImage.getWidth();
            int originalHeight = originalImage.getHeight();
            
            int newWidth = originalWidth;
            int newHeight = originalHeight;
            
            // Scale down if image is too large
            if (originalWidth > MAX_WIDTH || originalHeight > MAX_HEIGHT) {
                double widthRatio = (double) MAX_WIDTH / originalWidth;
                double heightRatio = (double) MAX_HEIGHT / originalHeight;
                double ratio = Math.min(widthRatio, heightRatio);
                
                newWidth = (int) (originalWidth * ratio);
                newHeight = (int) (originalHeight * ratio);
            }
            
            // Process image with Thumbnailator
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            
            Thumbnails.of(originalImage)
                    .size(newWidth, newHeight)
                    .outputQuality(QUALITY)
                    .outputFormat("jpg")
                    .toOutputStream(outputStream);
            
            byte[] processedImage = outputStream.toByteArray();
            
            // If still too large, reduce quality further
            if (processedImage.length > MAX_FILE_SIZE) {
                outputStream.reset();
                Thumbnails.of(originalImage)
                        .size(newWidth, newHeight)
                        .outputQuality(0.7f)
                        .outputFormat("jpg")
                        .toOutputStream(outputStream);
                processedImage = outputStream.toByteArray();
            }
            
            // If still too large, reduce size further
            if (processedImage.length > MAX_FILE_SIZE) {
                outputStream.reset();
                Thumbnails.of(originalImage)
                        .size(newWidth / 2, newHeight / 2)
                        .outputQuality(0.6f)
                        .outputFormat("jpg")
                        .toOutputStream(outputStream);
                processedImage = outputStream.toByteArray();
            }
            
            return processedImage;
        }
    }
    
    /**
     * Check if the image file is valid
     * @param imageFile The image file to validate
     * @return true if valid, false otherwise
     */
    public boolean isValidImage(MultipartFile imageFile) {
        if (imageFile == null || imageFile.isEmpty()) {
            return false;
        }
        
        String contentType = imageFile.getContentType();
        if (contentType == null) {
            return false;
        }
        
        return contentType.startsWith("image/");
    }
    
    /**
     * Get the file extension for the processed image
     * @return "jpg" as we always convert to JPEG
     */
    public String getProcessedImageExtension() {
        return "jpg";
    }
}
