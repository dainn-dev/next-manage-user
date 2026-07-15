package com.vehiclemanagement.chatbot;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

public interface ChatProvider {
    ToolPlan plan(String message);

    record ToolPlan(String toolName, Map<String,String> arguments, String model,
                    int inputTokens, int outputTokens) {}
}
