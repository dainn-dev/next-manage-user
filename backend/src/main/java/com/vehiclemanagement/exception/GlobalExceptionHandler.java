package com.vehiclemanagement.exception;

import com.vehiclemanagement.billing.EntitlementExceededException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFoundException(ResourceNotFoundException ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                ex.getMessage(),
                LocalDateTime.now()
        );
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        
        ValidationErrorResponse error = new ValidationErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                "Validation failed",
                errors,
                LocalDateTime.now()
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                ex.getMessage(),
                LocalDateTime.now()
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolationException(DataIntegrityViolationException ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                "Request conflicts with existing data",
                LocalDateTime.now()
        );
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(EntitlementExceededException.class)
    public ResponseEntity<EntitlementErrorResponse> handleEntitlementExceededException(EntitlementExceededException ex) {
        EntitlementErrorResponse error = new EntitlementErrorResponse(
                HttpStatus.FORBIDDEN.value(),
                ex.getMessage(),
                LocalDateTime.now(),
                ex.getCode(),
                ex.getMetric(),
                ex.getLimit(),
                ex.getCurrentUsage(),
                ex.getUpgradeUrl()
        );
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }
    
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        // Bad credentials / unknown user during login must be 401, not 500.
        // Keep the message generic so it doesn't reveal whether the account exists.
        ErrorResponse error = new ErrorResponse(
                HttpStatus.UNAUTHORIZED.value(),
                "Invalid username or password",
                LocalDateTime.now()
        );
        return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGlobalException(Exception ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "An unexpected error occurred: " + ex.getMessage(),
                LocalDateTime.now()
        );
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
    // Error response classes
    public static class ErrorResponse {
        private int status;
        private String message;
        private LocalDateTime timestamp;
        
        public ErrorResponse(int status, String message, LocalDateTime timestamp) {
            this.status = status;
            this.message = message;
            this.timestamp = timestamp;
        }
        
        // Getters and setters
        public int getStatus() {
            return status;
        }
        
        public void setStatus(int status) {
            this.status = status;
        }
        
        public String getMessage() {
            return message;
        }
        
        public void setMessage(String message) {
            this.message = message;
        }
        
        public LocalDateTime getTimestamp() {
            return timestamp;
        }
        
        public void setTimestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
        }
    }
    
    public static class ValidationErrorResponse extends ErrorResponse {
        private Map<String, String> fieldErrors;
        
        public ValidationErrorResponse(int status, String message, Map<String, String> fieldErrors, LocalDateTime timestamp) {
            super(status, message, timestamp);
            this.fieldErrors = fieldErrors;
        }
        
        public Map<String, String> getFieldErrors() {
            return fieldErrors;
        }
        
        public void setFieldErrors(Map<String, String> fieldErrors) {
            this.fieldErrors = fieldErrors;
        }
    }

    public static class EntitlementErrorResponse extends ErrorResponse {
        private String code;
        private String metric;
        private long limit;
        private long currentUsage;
        private String upgradeUrl;

        public EntitlementErrorResponse(int status, String message, LocalDateTime timestamp,
                                        String code, String metric, long limit, long currentUsage,
                                        String upgradeUrl) {
            super(status, message, timestamp);
            this.code = code;
            this.metric = metric;
            this.limit = limit;
            this.currentUsage = currentUsage;
            this.upgradeUrl = upgradeUrl;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMetric() {
            return metric;
        }

        public void setMetric(String metric) {
            this.metric = metric;
        }

        public long getLimit() {
            return limit;
        }

        public void setLimit(long limit) {
            this.limit = limit;
        }

        public long getCurrentUsage() {
            return currentUsage;
        }

        public void setCurrentUsage(long currentUsage) {
            this.currentUsage = currentUsage;
        }

        public String getUpgradeUrl() {
            return upgradeUrl;
        }

        public void setUpgradeUrl(String upgradeUrl) {
            this.upgradeUrl = upgradeUrl;
        }
    }
}
