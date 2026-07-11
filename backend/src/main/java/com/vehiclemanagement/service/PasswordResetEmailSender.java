package com.vehiclemanagement.service;

public interface PasswordResetEmailSender {

    void sendPasswordReset(String recipientEmail, String resetUrl);
}
